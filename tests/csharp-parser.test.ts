import { describe, expect, it } from 'bun:test';
import { CSharpParser } from '../src/core/parser/csharp';
import { ParserDispatcher } from '../src/core/parser/dispatcher';

describe('CSharpParser', () => {
  const parser = new CSharpParser();

  it('Scenario 1: should parse entire C# file when no target symbol is specified', () => {
    const code = `
      // Sample C# File
      namespace SampleApp;

      public class Greeter
      {
          public string SayHello() => "Hello World";
      }
    `;

    const result = parser.parse('src/Greeter.cs', code);
    expect(result.found).toBe(true);
    expect(result.fingerprint).toBeString();
    expect(result.fingerprint.length).toBe(64);
    expect(result.rawMatchedContent).toBe(code);
  });

  it('Scenario 2: should extract C# Class & Method with Attributes via ClassName::MethodName and ClassName.MethodName', () => {
    const code = `
      namespace WebApp.Controllers;

      [ApiController]
      [Route("api/[controller]")]
      public class UsersController : ControllerBase
      {
          private readonly IUserService _userService;

          public UsersController(IUserService userService)
          {
              _userService = userService;
          }

          [HttpGet("{id}")]
          [Authorize(Roles = "Admin,Manager")]
          public async Task<IActionResult> GetUser([FromRoute] string id)
          {
              var user = await _userService.FindByIdAsync(id);
              if (user == null) return NotFound();
              return Ok(user);
          }

          [HttpPost]
          public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
          {
              var created = await _userService.CreateAsync(dto);
              return CreatedAtAction(nameof(GetUser), new { id = created.Id }, created);
          }
      }
    `;

    // 1. Scoped via ::
    const resultColon = parser.parse('Controllers/UsersController.cs', code, 'UsersController::GetUser');
    expect(resultColon.found).toBe(true);
    expect(resultColon.rawMatchedContent).toContain('[HttpGet("{id}")]');
    expect(resultColon.rawMatchedContent).toContain('[Authorize(Roles = "Admin,Manager")]');
    expect(resultColon.rawMatchedContent).toContain('public async Task<IActionResult> GetUser');
    expect(resultColon.rawMatchedContent).toContain('return Ok(user);');

    // 2. Scoped via .
    const resultDot = parser.parse('Controllers/UsersController.cs', code, 'UsersController.GetUser');
    expect(resultDot.found).toBe(true);
    expect(resultDot.fingerprint).toBe(resultColon.fingerprint);

    // 3. Direct method name
    const resultDirect = parser.parse('Controllers/UsersController.cs', code, 'GetUser');
    expect(resultDirect.found).toBe(true);
    expect(resultDirect.fingerprint).toBe(resultColon.fingerprint);

    // 4. Class extraction
    const classResult = parser.parse('Controllers/UsersController.cs', code, 'UsersController');
    expect(classResult.found).toBe(true);
    expect(classResult.rawMatchedContent).toContain('[ApiController]');
    expect(classResult.rawMatchedContent).toContain('[Route("api/[controller]")]');
    expect(classResult.rawMatchedContent).toContain('public class UsersController');
    expect(classResult.rawMatchedContent).toContain('CreateUser');
  });

  it('Scenario 3: should extract positional record, record struct, nominal record, and interface', () => {
    const code = `
      namespace Domain.Models;

      public record UserDto(int Id, string Name, string Email);

      public readonly record struct Point(double X, double Y);

      public record Person
      {
          public string FirstName { get; init; } = string.Empty;
          public string LastName { get; init; } = string.Empty;
      }

      public interface IUserRepository
      {
          Task<UserDto?> GetByIdAsync(int id);
          Task SaveAsync(UserDto user);
      }

      public enum AccountStatus
      {
          Pending,
          Active,
          Suspended
      }
    `;

    // Positional record with semicolon
    const recordResult = parser.parse('Models.cs', code, 'UserDto');
    expect(recordResult.found).toBe(true);
    expect(recordResult.rawMatchedContent).toContain('public record UserDto(int Id, string Name, string Email);');

    // Record struct
    const structResult = parser.parse('Models.cs', code, 'Point');
    expect(structResult.found).toBe(true);
    expect(structResult.rawMatchedContent).toContain('public readonly record struct Point(double X, double Y);');

    // Nominal record with braces
    const personResult = parser.parse('Models.cs', code, 'Person');
    expect(personResult.found).toBe(true);
    expect(personResult.rawMatchedContent).toContain('public string FirstName { get; init; }');

    // Interface
    const interfaceResult = parser.parse('Models.cs', code, 'IUserRepository');
    expect(interfaceResult.found).toBe(true);
    expect(interfaceResult.rawMatchedContent).toContain('public interface IUserRepository');
    expect(interfaceResult.rawMatchedContent).toContain('Task<UserDto?> GetByIdAsync');

    // Enum
    const enumResult = parser.parse('Models.cs', code, 'AccountStatus');
    expect(enumResult.found).toBe(true);
    expect(enumResult.rawMatchedContent).toContain('Active');
  });

  it('Scenario 4: should guarantee formatting and XML documentation comments immunity', () => {
    const codeA = `
      namespace Demo;

      /// <summary>
      /// Kalkulator matematika sederhana.
      /// </summary>
      public class Calculator
      {
          /// <summary>
          /// Menambahkan dua angka integer.
          /// </summary>
          /// <param name="a">Angka pertama</param>
          /// <param name="b">Angka kedua</param>
          /// <returns>Hasil penjumlahan</returns>
          [Benchmark]
          public int Add(int a, int b)
          {
              return a + b;
          }
      }
    `;

    const codeB = `
      namespace Demo;

      // Komentar biasa yang berbeda
      public class Calculator {
          /* Block comment lain */
          [Benchmark]
          public int Add(int a, int b) {
            return a + b;
          }
      }
    `;

    const resultA = parser.parse('Calculator.cs', codeA, 'Calculator::Add');
    const resultB = parser.parse('Calculator.cs', codeB, 'Calculator::Add');

    expect(resultA.found).toBe(true);
    expect(resultB.found).toBe(true);
    expect(resultA.fingerprint).toBe(resultB.fingerprint);
  });

  it('Scenario 5: should extract expression-bodied methods and properties', () => {
    const code = `
      namespace Services;

      public class MathService
      {
          public double Pi => 3.14159265359;

          public int Multiply(int x, int y) => x * y;
      }
    `;

    const methodResult = parser.parse('MathService.cs', code, 'MathService::Multiply');
    expect(methodResult.found).toBe(true);
    expect(methodResult.rawMatchedContent).toContain('public int Multiply(int x, int y) => x * y;');

    const propResult = parser.parse('MathService.cs', code, 'MathService::Pi');
    expect(propResult.found).toBe(true);
    expect(propResult.rawMatchedContent).toContain('public double Pi => 3.14159265359;');
  });

  it('Scenario 6: should extract constructor with base/this initializer', () => {
    const code = `
      namespace Exceptions;

      public class NotFoundCustomException : Exception
      {
          public NotFoundCustomException(string resource, object key)
              : base($"Resource '{resource}' ({key}) was not found.")
          {
          }
      }
    `;

    const ctorResult = parser.parse('Exceptions.cs', code, 'NotFoundCustomException::NotFoundCustomException');
    expect(ctorResult.found).toBe(true);
    expect(ctorResult.rawMatchedContent).toContain(': base(');
  });

  it('Scenario 7: should return found: false for non-existent symbols', () => {
    const code = `
      public class SampleClass
      {
          public void ExistingMethod() {}
      }
    `;

    const notFound = parser.parse('Sample.cs', code, 'NonExistentMethod');
    expect(notFound.found).toBe(false);
    expect(notFound.fingerprint).toBe('');

    const notFoundScoped = parser.parse('Sample.cs', code, 'SampleClass::NonExistent');
    expect(notFoundScoped.found).toBe(false);
  });

  it('Scenario 8: should support symbol discovery via findSymbols', () => {
    const code = `
      namespace MyCompany.Core;

      public interface IGreeter
      {
          string Greet(string name);
      }

      public class GreeterService : IGreeter
      {
          public GreeterService() {}

          public string Greet(string name)
          {
              return $"Hello, {name}!";
          }
      }

      public record GreetingMessage(string Message, DateTime Timestamp);

      public enum Status
      {
          Draft,
          Sent
      }
    `;

    const symbols = parser.findSymbols('GreeterService.cs', code);
    expect(symbols.length).toBeGreaterThan(0);

    const interfaceSymbol = symbols.find((s) => s.name === 'IGreeter');
    expect(interfaceSymbol).toBeDefined();
    expect(interfaceSymbol?.kind).toBe('interface');

    const classSymbol = symbols.find((s) => s.name === 'GreeterService');
    expect(classSymbol).toBeDefined();
    expect(classSymbol?.kind).toBe('class');

    const methodSymbol = symbols.find((s) => s.name === 'Greet');
    expect(methodSymbol).toBeDefined();
    expect(methodSymbol?.kind).toBe('method');

    const recordSymbol = symbols.find((s) => s.name === 'GreetingMessage');
    expect(recordSymbol).toBeDefined();
    expect(recordSymbol?.kind).toBe('class');

    const enumSymbol = symbols.find((s) => s.name === 'Status');
    expect(enumSymbol).toBeDefined();
    expect(enumSymbol?.kind).toBe('type');
  });

  it('Scenario 9: should integrate seamlessly with ParserDispatcher for .cs files', async () => {
    const dispatcher = new ParserDispatcher();
    const parserInstance = dispatcher.getParserForFile('src/Services/OrderService.cs');
    expect(parserInstance).toBeInstanceOf(CSharpParser);

    const code = `
      namespace App;

      public class OrderService
      {
          public void ProcessOrder(int orderId)
          {
              // process
          }
      }
    `;

    const result = await dispatcher.parse('src/Services/OrderService.cs', code, 'OrderService::ProcessOrder');
    expect(result.found).toBe(true);
    expect(result.rawMatchedContent).toContain('public void ProcessOrder(int orderId)');
  });
});
