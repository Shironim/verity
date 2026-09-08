import { describe, expect, it } from 'bun:test';
import { RustParser } from '../src/core/parser/rust';

describe('RustParser', () => {
  const parser = new RustParser();

  it('Scenario 1: should parse entire Rust file when no target symbol is specified', () => {
    const code = `
      // Sample Rust module
      pub fn greet() {
          println!("Hello world");
      }
    `;

    const result = parser.parse('src/lib.rs', code);
    expect(result.found).toBe(true);
    expect(result.fingerprint).toBeString();
    expect(result.fingerprint.length).toBe(64);
  });

  it('Scenario 2: should extract standalone functions (pub, async, const, unsafe)', () => {
    const code = `
      use std::io;

      #[inline]
      pub async fn fetch_data(url: &str) -> Result<String, io::Error> {
          Ok(url.to_string())
      }

      pub const fn get_max_retry() -> u32 {
          5
      }

      unsafe fn raw_pointer_read(ptr: *const u8) -> u8 {
          *ptr
      }
    `;

    const asyncResult = parser.parse('src/network.rs', code, 'fetch_data');
    expect(asyncResult.found).toBe(true);
    expect(asyncResult.rawMatchedContent).toContain('pub async fn fetch_data');
    expect(asyncResult.rawMatchedContent).toContain('#[inline]');

    const constResult = parser.parse('src/network.rs', code, 'get_max_retry');
    expect(constResult.found).toBe(true);
    expect(constResult.rawMatchedContent).toContain('pub const fn get_max_retry');

    const unsafeResult = parser.parse('src/network.rs', code, 'raw_pointer_read');
    expect(unsafeResult.found).toBe(true);
    expect(unsafeResult.rawMatchedContent).toContain('unsafe fn raw_pointer_read');
  });

  it('Scenario 3: should extract struct, enum, and trait with attributes', () => {
    const code = `
      #[derive(Debug, Clone, PartialEq)]
      pub struct UserConfig {
          pub host: String,
          pub port: u16,
      }

      pub struct Point(pub f64, pub f64);

      #[repr(u8)]
      pub enum Status {
          Pending = 1,
          Active = 2,
          Failed = 3,
      }

      pub trait EventListener {
          fn on_event(&self, event: &str);
      }
    `;

    const structResult = parser.parse('src/types.rs', code, 'UserConfig');
    expect(structResult.found).toBe(true);
    expect(structResult.rawMatchedContent).toContain('#[derive(Debug, Clone, PartialEq)]');
    expect(structResult.rawMatchedContent).toContain('pub struct UserConfig');

    const tupleResult = parser.parse('src/types.rs', code, 'Point');
    expect(tupleResult.found).toBe(true);
    expect(tupleResult.rawMatchedContent).toContain('pub struct Point(pub f64, pub f64);');

    const enumResult = parser.parse('src/types.rs', code, 'Status');
    expect(enumResult.found).toBe(true);
    expect(enumResult.rawMatchedContent).toContain('#[repr(u8)]');
    expect(enumResult.rawMatchedContent).toContain('pub enum Status');

    const traitResult = parser.parse('src/types.rs', code, 'EventListener');
    expect(traitResult.found).toBe(true);
    expect(traitResult.rawMatchedContent).toContain('pub trait EventListener');
  });

  it('Scenario 4: should extract impl methods using Type::method and direct method name', () => {
    const code = `
      pub struct OrderService {
          db_conn: String,
      }

      impl OrderService {
          pub fn new(conn: &str) -> Self {
              OrderService {
                  db_conn: conn.to_string(),
              }
          }

          pub async fn process_order(&self, order_id: u64) -> bool {
              println!("Processing: {}", order_id);
              true
          }
      }

      impl std::fmt::Display for OrderService {
          fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
              write!(f, "OrderService({})", self.db_conn)
          }
      }
    `;

    const newResult = parser.parse('src/service.rs', code, 'OrderService::new');
    expect(newResult.found).toBe(true);
    expect(newResult.rawMatchedContent).toContain('pub fn new(conn: &str) -> Self');

    const processResult = parser.parse('src/service.rs', code, 'OrderService::process_order');
    expect(processResult.found).toBe(true);
    expect(processResult.rawMatchedContent).toContain('pub async fn process_order');

    const fmtResult = parser.parse('src/service.rs', code, 'OrderService::fmt');
    expect(fmtResult.found).toBe(true);
    expect(fmtResult.rawMatchedContent).toContain('fn fmt(');

    // Direct method name without type scoping
    const directResult = parser.parse('src/service.rs', code, 'process_order');
    expect(directResult.found).toBe(true);
    expect(directResult.rawMatchedContent).toContain('pub async fn process_order');
  });

  it('Scenario 5: should be immune to rustfmt formatting variations and comments', () => {
    const formattedCode = `
      // Configuration module documentation
      #[derive(Debug)]
      pub struct AppConfig {
          pub host: String,
          pub port: u16,
      }

      /* Multi-line comment explaining function */
      pub fn compute_sum(a: i32, b: i32) -> i32 {
          // Add both numbers
          a + b
      }
    `;

    const unformattedCode = `
      #[derive(Debug)]
      pub struct AppConfig { pub host: String, pub port: u16 }

      pub fn compute_sum(a: i32, b: i32) -> i32 { a + b }
    `;

    const structFormatted = parser.parse('src/config.rs', formattedCode, 'AppConfig');
    const structUnformatted = parser.parse('src/config.rs', unformattedCode, 'AppConfig');
    expect(structFormatted.found).toBe(true);
    expect(structUnformatted.found).toBe(true);
    expect(structFormatted.fingerprint).toBe(structUnformatted.fingerprint);

    const fnFormatted = parser.parse('src/config.rs', formattedCode, 'compute_sum');
    const fnUnformatted = parser.parse('src/config.rs', unformattedCode, 'compute_sum');
    expect(fnFormatted.found).toBe(true);
    expect(fnUnformatted.found).toBe(true);
    expect(fnFormatted.fingerprint).toBe(fnUnformatted.fingerprint);
  });

  it('Scenario 6: should handle raw string literals and nested braces inside functions correctly', () => {
    const code = `
      pub fn parse_json_schema() -> &'static str {
          let schema = r#"{"name": "verity", "version": 1, "nested": {"active": true}}"#;
          let code_snippet = r##"r#"nested hashes"#"##;
          schema
      }
    `;

    const result = parser.parse('src/schema.rs', code, 'parse_json_schema');
    expect(result.found).toBe(true);
    expect(result.rawMatchedContent).toContain('r#"{"name": "verity"');
    expect(result.rawMatchedContent).toContain('schema\n      }');
  });

  it('Scenario 7: should discover all symbols via findSymbols with line ranges', () => {
    const code = `
      pub struct Point {
          pub x: f64,
          pub y: f64,
      }

      pub enum Direction {
          North,
          South,
      }

      pub trait Moveable {
          fn move_by(&mut self, dx: f64, dy: f64);
      }

      pub fn distance(p1: &Point, p2: &Point) -> f64 {
          ((p1.x - p2.x).powi(2) + (p1.y - p2.y).powi(2)).sqrt()
      }
    `;

    const symbols = parser.findSymbols('src/geometry.rs', code);
    const names = symbols.map((s) => s.name);

    expect(names).toContain('Point');
    expect(names).toContain('Direction');
    expect(names).toContain('Moveable');
    expect(names).toContain('distance');

    const point = symbols.find((s) => s.name === 'Point');
    expect(point?.kind).toBe('class');
    expect(point?.startLine).toBeGreaterThan(0);

    const distance = symbols.find((s) => s.name === 'distance');
    expect(distance?.kind).toBe('function');
    expect(distance?.startLine).toBeGreaterThan(0);
  });

  it('Scenario 8: should return found: false when requested symbol does not exist', () => {
    const code = `
      pub fn existing_fn() -> bool {
          true
      }
    `;

    const result = parser.parse('src/lib.rs', code, 'non_existent_symbol');
    expect(result.found).toBe(false);
    expect(result.fingerprint).toBe('');
  });
});
