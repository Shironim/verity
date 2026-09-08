import { describe, expect, it } from 'bun:test';
import { PythonParser } from '../src/core/parser/python';

const samplePythonCode = `"""
Module docstring for test sample.
"""
from typing import List, Optional
import asyncio

def calculate_score(val: int) -> float:
    """Calculate the score based on val."""
    if val > 100:
        return 100.0
    return float(val * 1.5)

async def fetch_data(url: str, timeout: int = 30) -> dict:
    """Fetch remote data asynchronously."""
    await asyncio.sleep(0.01)
    return {"url": url, "status": "ok"}

@decorator_a
@router.post("/chat")
def handle_chat(request_data: dict) -> dict:
    """
    Handle incoming chat requests.

    Args:
        request_data: Dictionary containing message payload
    """
    return {"response": "acknowledged"}

class AgentExecutor:
    """Class representing an agent workflow executor."""

    DEFAULT_RETRIES = 3

    def __init__(self, name: str, retries: int = DEFAULT_RETRIES):
        self.name = name
        self.retries = retries

    def run(self, task: str) -> str:
        # Execute the given task
        return f"Agent {self.name} completed {task}"

    @property
    def is_active(self) -> bool:
        return True

    @staticmethod
    async def ping() -> str:
        return "pong"
`;

describe('PythonParser', () => {
  const parser = new PythonParser();

  it('Scenario 1: should parse entire Python file when no target symbol is specified', () => {
    const result = parser.parse('agent.py', samplePythonCode);
    expect(result.found).toBe(true);
    expect(result.fingerprint).toBeDefined();
    expect(result.fingerprint.length).toBe(64);
    expect(result.rawMatchedContent).toBe(samplePythonCode);
  });

  it('Scenario 2: should extract sync and async functions including indented body', () => {
    // 1. Sync function
    const syncResult = parser.parse('agent.py', samplePythonCode, 'calculate_score');
    expect(syncResult.found).toBe(true);
    expect(syncResult.targetSymbol).toBe('calculate_score');
    expect(syncResult.rawMatchedContent).toContain('def calculate_score(val: int) -> float:');
    expect(syncResult.rawMatchedContent).toContain('return float(val * 1.5)');

    // 2. Async function
    const asyncResult = parser.parse('agent.py', samplePythonCode, 'fetch_data');
    expect(asyncResult.found).toBe(true);
    expect(asyncResult.targetSymbol).toBe('fetch_data');
    expect(asyncResult.rawMatchedContent).toContain('async def fetch_data(url: str, timeout: int = 30) -> dict:');
    expect(asyncResult.rawMatchedContent).toContain('await asyncio.sleep(0.01)');
  });

  it('Scenario 3: should extract class definition and methods using Class::method and Class.method notation', () => {
    // 1. Full class definition
    const classResult = parser.parse('agent.py', samplePythonCode, 'AgentExecutor');
    expect(classResult.found).toBe(true);
    expect(classResult.rawMatchedContent).toContain('class AgentExecutor:');
    expect(classResult.rawMatchedContent).toContain('def run(self, task: str) -> str:');

    // 2. Method using Class::method notation
    const methodResultColon = parser.parse('agent.py', samplePythonCode, 'AgentExecutor::run');
    expect(methodResultColon.found).toBe(true);
    expect(methodResultColon.targetSymbol).toBe('AgentExecutor::run');
    expect(methodResultColon.rawMatchedContent).toContain('def run(self, task: str) -> str:');
    expect(methodResultColon.rawMatchedContent).toContain('Agent {self.name} completed {task}');

    // 3. Method using Class.method notation
    const methodResultDot = parser.parse('agent.py', samplePythonCode, 'AgentExecutor.run');
    expect(methodResultDot.found).toBe(true);
    expect(methodResultDot.targetSymbol).toBe('AgentExecutor.run');
    expect(methodResultDot.fingerprint).toBe(methodResultColon.fingerprint);

    // 4. Method query directly by method name
    const methodDirect = parser.parse('agent.py', samplePythonCode, 'run');
    expect(methodDirect.found).toBe(true);
    expect(methodDirect.rawMatchedContent).toContain('def run(self, task: str) -> str:');
  });

  it('Scenario 4: should capture decorators and multiline docstrings seamlessly', () => {
    const chatResult = parser.parse('agent.py', samplePythonCode, 'handle_chat');
    expect(chatResult.found).toBe(true);
    expect(chatResult.targetSymbol).toBe('handle_chat');
    // Verifikasi decorator terisolasi
    expect(chatResult.rawMatchedContent).toContain('@decorator_a');
    expect(chatResult.rawMatchedContent).toContain('@router.post("/chat")');
    // Verifikasi multiline docstring
    expect(chatResult.rawMatchedContent).toContain('Handle incoming chat requests.');
    expect(chatResult.rawMatchedContent).toContain('Dictionary containing message payload');
    expect(chatResult.rawMatchedContent).toContain('return {"response": "acknowledged"}');

    // Verifikasi decorator pada class method
    const propResult = parser.parse('agent.py', samplePythonCode, 'AgentExecutor::is_active');
    expect(propResult.found).toBe(true);
    expect(propResult.rawMatchedContent).toContain('@property');
    expect(propResult.rawMatchedContent).toContain('def is_active(self) -> bool:');

    const staticResult = parser.parse('agent.py', samplePythonCode, 'AgentExecutor::ping');
    expect(staticResult.found).toBe(true);
    expect(staticResult.rawMatchedContent).toContain('@staticmethod');
    expect(staticResult.rawMatchedContent).toContain('async def ping() -> str:');
  });

  it('Scenario 5: should be immune to formatting variations (Black / Ruff / PEP 8) and comments', () => {
    const codeA = `
# Module level comment explaining algorithm
def calculate_score(val: int) -> float:
    # First step: multiply by factor
    result = val * 1.5
    # Return formatted score
    return {
        'score': result,
    }
`;

    const codeB = `
def calculate_score(   val:   int   ) -> float:
    result = val * 1.5
    return {
        "score": result
    }
`;

    const resultA = parser.parse('calc.py', codeA, 'calculate_score');
    const resultB = parser.parse('calc.py', codeB, 'calculate_score');

    expect(resultA.found).toBe(true);
    expect(resultB.found).toBe(true);
    expect(resultA.fingerprint).toBe(resultB.fingerprint);
  });

  it('should detect actual logic changes and generate different fingerprints', () => {
    const codeOriginal = `
def process(x: int) -> int:
    return x + 10
`;

    const codeModified = `
def process(x: int) -> int:
    return x * 10
`;

    const resOriginal = parser.parse('math.py', codeOriginal, 'process');
    const resModified = parser.parse('math.py', codeModified, 'process');

    expect(resOriginal.found).toBe(true);
    expect(resModified.found).toBe(true);
    expect(resOriginal.fingerprint).not.toBe(resModified.fingerprint);
  });

  it('should discover all symbols via findSymbols with accurate types and line boundaries', () => {
    const symbols = parser.findSymbols('agent.py', samplePythonCode);
    const names = symbols.map((s) => s.name);

    expect(names).toContain('calculate_score');
    expect(names).toContain('fetch_data');
    expect(names).toContain('handle_chat');
    expect(names).toContain('AgentExecutor');
    expect(names).toContain('__init__');
    expect(names).toContain('run');
    expect(names).toContain('is_active');
    expect(names).toContain('ping');

    const agentClass = symbols.find((s) => s.name === 'AgentExecutor');
    expect(agentClass).toBeDefined();
    expect(agentClass?.kind).toBe('class');

    const runMethod = symbols.find((s) => s.name === 'run');
    expect(runMethod).toBeDefined();
    expect(runMethod?.kind).toBe('method');

    const calcFunc = symbols.find((s) => s.name === 'calculate_score');
    expect(calcFunc).toBeDefined();
    expect(calcFunc?.kind).toBe('function');
  });

  it('should return found: false when requested symbol does not exist', () => {
    const result = parser.parse('agent.py', samplePythonCode, 'nonExistentFunction');
    expect(result.found).toBe(false);
    expect(result.fingerprint).toBe('');
  });
});
