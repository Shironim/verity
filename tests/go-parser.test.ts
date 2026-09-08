import { describe, expect, it } from 'bun:test';
import { GoParser } from '../src/core/parser/go';

describe('GoParser', () => {
  const parser = new GoParser();

  const sampleGoCode = `package service

import (
	"context"
	"fmt"
)

// User represents a system user
type User struct {
	ID    int64  \`json:"id" db:"user_id"\`
	Name  string \`json:"name"\`
	Email string \`json:"email"\`
}

// Greeter defines greeting behaviors
type Greeter interface {
	Greet(name string) string
}

// CalculateTotal calculates total price with tax
func CalculateTotal(amount float64, taxRate float64) float64 {
	return amount + (amount * taxRate)
}

type OrderService struct {
	repo Repository
}

// ProcessOrder processes a single user order
func (s *OrderService) ProcessOrder(ctx context.Context, u *User, amount float64) error {
	if amount <= 0 {
		return fmt.Errorf("invalid amount: %f", amount)
	}
	return nil
}

type Geometry struct{}

func (g Geometry) Measure() float64 {
	return 42.0
}
`;

  it('should parse entire Go file when no target symbol is specified', () => {
    const result = parser.parse('main.go', sampleGoCode);

    expect(result.found).toBe(true);
    expect(result.fingerprint).toBeDefined();
    expect(result.fingerprint.length).toBe(64);
  });

  it('should extract standalone function by name', () => {
    const result = parser.parse('main.go', sampleGoCode, 'CalculateTotal');

    expect(result.found).toBe(true);
    expect(result.targetSymbol).toBe('CalculateTotal');
    expect(result.rawMatchedContent).toContain('func CalculateTotal');
    expect(result.rawMatchedContent).toContain('return amount + (amount * taxRate)');
  });

  it('should extract method with pointer receiver using Receiver::Method notation', () => {
    const result = parser.parse('main.go', sampleGoCode, 'OrderService::ProcessOrder');

    expect(result.found).toBe(true);
    expect(result.targetSymbol).toBe('OrderService::ProcessOrder');
    expect(result.rawMatchedContent).toContain('func (s *OrderService) ProcessOrder');
    expect(result.rawMatchedContent).toContain('invalid amount');
  });

  it('should extract method with value receiver using Receiver::Method notation', () => {
    const result = parser.parse('main.go', sampleGoCode, 'Geometry::Measure');

    expect(result.found).toBe(true);
    expect(result.rawMatchedContent).toContain('func (g Geometry) Measure');
    expect(result.rawMatchedContent).toContain('return 42.0');
  });

  it('should extract method receiver by method name directly', () => {
    const result = parser.parse('main.go', sampleGoCode, 'ProcessOrder');

    expect(result.found).toBe(true);
    expect(result.rawMatchedContent).toContain('ProcessOrder');
  });

  it('should extract struct definition including backtick tags', () => {
    const result = parser.parse('main.go', sampleGoCode, 'User');

    expect(result.found).toBe(true);
    expect(result.targetSymbol).toBe('User');
    expect(result.rawMatchedContent).toContain('type User struct');
    expect(result.rawMatchedContent).toContain('`json:"id" db:"user_id"`');
  });

  it('should extract interface definition', () => {
    const result = parser.parse('main.go', sampleGoCode, 'Greeter');

    expect(result.found).toBe(true);
    expect(result.targetSymbol).toBe('Greeter');
    expect(result.rawMatchedContent).toContain('type Greeter interface');
    expect(result.rawMatchedContent).toContain('Greet(name string) string');
  });

  it('should parse generic Go functions correctly', () => {
    const genericCode = `
package utils

func Filter[T any](items []T, predicate func(T) bool) []T {
	var result []T
	for _, item := range items {
		if predicate(item) {
			result = append(result, item)
		}
	}
	return result
}
`;
    const result = parser.parse('utils.go', genericCode, 'Filter');

    expect(result.found).toBe(true);
    expect(result.rawMatchedContent).toContain('func Filter[T any]');
    expect(result.rawMatchedContent).toContain('result = append(result, item)');
  });

  it('should be immune to formatting variations, tabs, spaces, and comments in Go code', () => {
    const codeA = `
package math

// Add calculates sum
func Add(a int, b int) int {
	return a + b
}
`;

    const codeB = `
package math

/*
 * Add calculation with documentation
 */
func Add(   a int,   b int   ) int {
	// inline comment explaining addition
	return a + b;
}
`;

    const resultA = parser.parse('math.go', codeA, 'Add');
    const resultB = parser.parse('math.go', codeB, 'Add');

    expect(resultA.found).toBe(true);
    expect(resultB.found).toBe(true);
    expect(resultA.fingerprint).toBe(resultB.fingerprint);
  });

  it('should discover all symbols in Go file via findSymbols', () => {
    const symbols = parser.findSymbols('main.go', sampleGoCode);

    expect(symbols.length).toBeGreaterThanOrEqual(4);
    const names = symbols.map((s) => s.name);
    expect(names).toContain('User');
    expect(names).toContain('Greeter');
    expect(names).toContain('CalculateTotal');
    expect(names).toContain('ProcessOrder');
  });

  it('should return found: false when requested symbol does not exist', () => {
    const result = parser.parse('main.go', sampleGoCode, 'NonExistentFunc');

    expect(result.found).toBe(false);
    expect(result.fingerprint).toBe('');
  });
});
