import { describe, expect, it } from 'bun:test';
import { PhpParser } from '../src/core/parser/php';

const samplePhpCode = `<?php
namespace App\\Http\\Controllers;

use Illuminate\\Http\\Request;
use App\\Models\\User;

class UserController extends Controller {
    public function index(Request $request) {
        return response()->json(User::all());
    }

    public function store(Request $request) {
        $data = $request->validate([
            'name' => 'required|string',
            'email' => 'required|email|unique:users',
        ]);

        $user = User::create($data);
        return response()->json($user, 201);
    }

    private function sanitizeInput(array $input): array {
        return array_map('trim', $input);
    }
}

class HealthController {
    public function ping() {
        return 'pong';
    }
}
`;

describe('PhpParser', () => {
  const parser = new PhpParser();

  it('should parse entire PHP file when no target symbol is specified', () => {
    const result = parser.parse('UserController.php', samplePhpCode);
    expect(result.found).toBe(true);
    expect(result.fingerprint).toBeDefined();
    expect(result.fingerprint.length).toBe(64);
  });

  it('should extract specific method by name', () => {
    const result = parser.parse('UserController.php', samplePhpCode, 'store');
    expect(result.found).toBe(true);
    expect(result.targetSymbol).toBe('store');
    expect(result.rawMatchedContent).toContain('User::create($data)');
  });

  it('should extract method using Class::method notation', () => {
    const resultUser = parser.parse('UserController.php', samplePhpCode, 'UserController::index');
    expect(resultUser.found).toBe(true);
    expect(resultUser.rawMatchedContent).toContain('User::all()');

    const resultHealth = parser.parse('UserController.php', samplePhpCode, 'HealthController::ping');
    expect(resultHealth.found).toBe(true);
    expect(resultHealth.rawMatchedContent).toContain("'pong'");
  });

  it('should extract full class definition', () => {
    const result = parser.parse('UserController.php', samplePhpCode, 'HealthController');
    expect(result.found).toBe(true);
    expect(result.rawMatchedContent).toContain('function ping()');
  });

  it('should be immune to formatting variations and comments in PHP code', () => {
    const codeA = `<?php
class Service {
    public function execute($a, $b) {
        // execute calculation
        return [
            "result" => $a + $b,
        ];
    }
}
`;

    const codeB = `<?php
class Service
{
\tpublic function execute($a, $b)
\t{
\t\treturn [
\t\t\t"result" => $a + $b
\t\t];
\t}
}
`;

    const resultA = parser.parse('Service.php', codeA, 'execute');
    const resultB = parser.parse('Service.php', codeB, 'execute');

    expect(resultA.found).toBe(true);
    expect(resultB.found).toBe(true);
    expect(resultA.fingerprint).toBe(resultB.fingerprint);
  });

  it('should discover all symbols in PHP file', () => {
    const symbols = parser.findSymbols('UserController.php', samplePhpCode);
    const names = symbols.map((s) => s.name);

    expect(names).toContain('UserController');
    expect(names).toContain('HealthController');
    expect(names).toContain('index');
    expect(names).toContain('store');
    expect(names).toContain('sanitizeInput');
  });

  it('should return found: false when requested symbol does not exist', () => {
    const result = parser.parse('UserController.php', samplePhpCode, 'nonExistentMethod');
    expect(result.found).toBe(false);
    expect(result.fingerprint).toBe('');
  });
});
