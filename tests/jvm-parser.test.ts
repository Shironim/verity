import { describe, expect, it } from 'bun:test';
import { JvmParser } from '../src/core/parser/jvm';
import { ParserDispatcher } from '../src/core/parser/dispatcher';

describe('JvmParser', () => {
  const parser = new JvmParser();

  it('Scenario 1: should extract Java Class & Method with Annotations via ClassName::MethodName and methodName', () => {
    const javaCode = `
      package com.example.service;

      import org.springframework.stereotype.Service;
      import org.springframework.transaction.annotation.Transactional;
      import org.springframework.web.bind.annotation.PostMapping;
      import org.springframework.web.bind.annotation.RequestBody;
      import org.springframework.web.bind.annotation.RestController;

      @RestController
      @Service
      public class OrderService {

          /**
           * Process payment for the given order.
           */
          @Transactional
          @PostMapping("/pay")
          public void processPayment(@RequestBody String orderId) {
              System.out.println("Processing: " + orderId);
          }
      }
    `;

    // 1. Scoped query: OrderService::processPayment
    const scopedResult = parser.parse('src/OrderService.java', javaCode, 'OrderService::processPayment');
    expect(scopedResult.found).toBe(true);
    expect(scopedResult.fingerprint).toBeString();
    expect(scopedResult.fingerprint.length).toBe(64);
    expect(scopedResult.rawMatchedContent).toContain('@Transactional');
    expect(scopedResult.rawMatchedContent).toContain('@PostMapping("/pay")');
    expect(scopedResult.rawMatchedContent).toContain('public void processPayment');

    // 2. Unscoped query: processPayment
    const directResult = parser.parse('src/OrderService.java', javaCode, 'processPayment');
    expect(directResult.found).toBe(true);
    expect(directResult.fingerprint).toBe(scopedResult.fingerprint);
    expect(directResult.rawMatchedContent).toContain('processPayment');

    // 3. Class query: OrderService
    const classResult = parser.parse('src/OrderService.java', javaCode, 'OrderService');
    expect(classResult.found).toBe(true);
    expect(classResult.rawMatchedContent).toContain('@RestController');
    expect(classResult.rawMatchedContent).toContain('public class OrderService');
  });

  it('Scenario 2: should extract Kotlin data class, sealed class, suspend fun, and companion object', () => {
    const kotlinCode = `
      package com.example.user

      import kotlinx.serialization.Serializable

      @Serializable
      data class User(
          val id: String,
          val name: String
      )

      sealed class Result<out T> {
          data class Success<out T>(val data: T) : Result<T>()
          data class Error(val message: String) : Result<Nothing>()
      }

      class UserService(private val repo: UserRepository) {
          companion object Factory {
              fun create(): UserService = UserService(UserRepository())
          }

          suspend fun findUser(id: String): User {
              return repo.getById(id)
          }
      }
    `;

    // 1. Kotlin Data Class: User
    const userResult = parser.parse('src/UserService.kt', kotlinCode, 'User');
    expect(userResult.found).toBe(true);
    expect(userResult.fingerprint).toBeString();
    expect(userResult.rawMatchedContent).toContain('@Serializable');
    expect(userResult.rawMatchedContent).toContain('data class User');

    // 2. Kotlin Sealed Class: Result
    const resultClass = parser.parse('src/UserService.kt', kotlinCode, 'Result');
    expect(resultClass.found).toBe(true);
    expect(resultClass.rawMatchedContent).toContain('sealed class Result<out T>');

    // 3. Kotlin Member Function: UserService::findUser & findUser
    const funResultScoped = parser.parse('src/UserService.kt', kotlinCode, 'UserService::findUser');
    expect(funResultScoped.found).toBe(true);
    expect(funResultScoped.rawMatchedContent).toContain('suspend fun findUser(id: String): User');

    const funResultDirect = parser.parse('src/UserService.kt', kotlinCode, 'findUser');
    expect(funResultDirect.found).toBe(true);
    expect(funResultDirect.fingerprint).toBe(funResultScoped.fingerprint);

    // 4. Kotlin Companion Object
    const companionResult = parser.parse('src/UserService.kt', kotlinCode, 'companion object');
    expect(companionResult.found).toBe(true);
    expect(companionResult.rawMatchedContent).toContain('companion object Factory');

    const factoryResult = parser.parse('src/UserService.kt', kotlinCode, 'Factory');
    expect(factoryResult.found).toBe(true);
    expect(factoryResult.rawMatchedContent).toContain('companion object Factory');
  });

  it('Scenario 3: should guarantee formatting and Javadoc/KDoc comment immunity', () => {
    const javaCodeOriginal = `
      package com.example;

      /**
       * Original Javadoc Description
       * @version 1.0.0
       */
      public class Calculator {
          /**
           * Adds two numbers
           */
          public int add(int a, int b) {
              // Perform addition
              return a + b;
          }
      }
    `;

    const javaCodeModified = `
      package com.example;

      /**
       * Heavily modified Javadoc with extra documentation notes!
       * @author engineer
       * @since 2026-09-08
       */
      public class Calculator
      {

          /**
           * Adds two integers together with different comments.
           */
          public int add( int a , int b )
          {
              // Different inline comment
              /* block comment */
              return a + b ;
          }
      }
    `;

    const resultOriginal = parser.parse('Calculator.java', javaCodeOriginal, 'Calculator::add');
    const resultModified = parser.parse('Calculator.java', javaCodeModified, 'Calculator::add');

    expect(resultOriginal.found).toBe(true);
    expect(resultModified.found).toBe(true);
    // Fingerprints must be 100% identical regardless of comments and whitespace
    expect(resultOriginal.fingerprint).toBe(resultModified.fingerprint);
  });

  it('Scenario 4: should extract Java record, interface, and enum types', () => {
    const javaCode = `
      package com.example.domain;

      public interface EntityRepository<T> {
          T findById(Long id);
          void save(T entity);
      }

      public record UserRecord(Long id, String email) implements Serializable {}

      public enum AccountStatus {
          PENDING,
          ACTIVE,
          SUSPENDED
      }
    `;

    const repoResult = parser.parse('domain.java', javaCode, 'EntityRepository');
    expect(repoResult.found).toBe(true);
    expect(repoResult.rawMatchedContent).toContain('public interface EntityRepository<T>');

    const recordResult = parser.parse('domain.java', javaCode, 'UserRecord');
    expect(recordResult.found).toBe(true);
    expect(recordResult.rawMatchedContent).toContain('public record UserRecord');

    const enumResult = parser.parse('domain.java', javaCode, 'AccountStatus');
    expect(enumResult.found).toBe(true);
    expect(enumResult.rawMatchedContent).toContain('public enum AccountStatus');
  });

  it('Scenario 5: should extract symbol nodes via findSymbols', () => {
    const code = `
      package com.example;

      public class Greeter {
          public String greet(String name) {
              return "Hello, " + name;
          }
      }
    `;

    const symbols = parser.findSymbols('src/Greeter.java', code);
    expect(symbols.length).toBeGreaterThanOrEqual(2);

    const classSym = symbols.find((s) => s.name === 'Greeter');
    expect(classSym).toBeDefined();
    expect(classSym?.kind).toBe('class');

    const methodSym = symbols.find((s) => s.name === 'greet');
    expect(methodSym).toBeDefined();
    expect(methodSym?.kind).toBe('method');
  });

  it('Scenario 6: should parse through ParserDispatcher for .java and .kt files', async () => {
    const dispatcher = new ParserDispatcher();

    const javaCode = `
      package com.test;
      public class DispatchTest {
          public void run() {}
      }
    `;

    const ktCode = `
      package com.test
      fun runKt() = println("Running")
    `;

    const javaResult = await dispatcher.parse('test.java', javaCode, 'DispatchTest::run');
    expect(javaResult.found).toBe(true);

    const ktResult = await dispatcher.parse('test.kt', ktCode, 'runKt');
    expect(ktResult.found).toBe(true);
  });
});
