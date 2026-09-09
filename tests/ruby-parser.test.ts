import { describe, expect, it } from 'bun:test';
import { RubyParser } from '../src/core/parser/ruby';
import { ParserDispatcher } from '../src/core/parser/dispatcher';

const sampleRubyCode = `# frozen_string_literal: true

module Billing
  # Handles invoice processing and lifecycle
  class Invoice < ApplicationRecord
    belongs_to :order

    def self.notify(user)
      return if user.nil?
      # Send notification
      puts "Notifying #{user.name}"
    end

    def process
      if valid?
        items.each do |item|
          item.save! if item.changed?
        end
        true
      else
        false
      end
    end
  end
end

class OrdersController < ApplicationController
  def index
    # Fetch orders
    @orders = Order.all
    render json: @orders
  end

  def self.notify(order_id)
    order = find(order_id)
    return unless order
    order.broadcast_update
  end
end
`;

describe('RubyParser', () => {
  const parser = new RubyParser();

  describe('Scenario 1: Ruby Method Extraction (Instance & Class)', () => {
    it('should extract instance method using ClassName#method_name syntax', () => {
      const result = parser.parse('app/controllers/orders_controller.rb', sampleRubyCode, 'OrdersController#index');

      expect(result.found).toBe(true);
      expect(result.targetSymbol).toBe('OrdersController#index');
      expect(result.rawMatchedContent).toBeDefined();
      expect(result.rawMatchedContent).toContain('def index');
      expect(result.rawMatchedContent).toContain('render json: @orders');
      expect(result.rawMatchedContent).toContain('end');
      expect(result.fingerprint).not.toBe('');
    });

    it('should extract class/singleton method using ClassName::method_name syntax', () => {
      const result = parser.parse('app/controllers/orders_controller.rb', sampleRubyCode, 'OrdersController::notify');

      expect(result.found).toBe(true);
      expect(result.targetSymbol).toBe('OrdersController::notify');
      expect(result.rawMatchedContent).toBeDefined();
      expect(result.rawMatchedContent).toContain('def self.notify(order_id)');
      expect(result.rawMatchedContent).toContain('order.broadcast_update');
      expect(result.rawMatchedContent).toContain('end');
      expect(result.fingerprint).not.toBe('');
    });
  });

  describe('Scenario 2: Module & Class Extraction', () => {
    it('should extract module block by module name', () => {
      const result = parser.parse('app/models/billing.rb', sampleRubyCode, 'Billing');

      expect(result.found).toBe(true);
      expect(result.targetSymbol).toBe('Billing');
      expect(result.rawMatchedContent).toBeDefined();
      expect(result.rawMatchedContent?.startsWith('module Billing')).toBe(true);
      expect(result.rawMatchedContent).toContain('class Invoice < ApplicationRecord');
      expect(result.rawMatchedContent?.endsWith('end')).toBe(true);
    });

    it('should extract class block by class name', () => {
      const result = parser.parse('app/models/invoice.rb', sampleRubyCode, 'Invoice');

      expect(result.found).toBe(true);
      expect(result.targetSymbol).toBe('Invoice');
      expect(result.rawMatchedContent).toBeDefined();
      expect(result.rawMatchedContent).toContain('class Invoice < ApplicationRecord');
      expect(result.rawMatchedContent).toContain('def process');
      expect(result.rawMatchedContent?.endsWith('end')).toBe(true);
    });
  });

  describe('Scenario 3: Formatting & RuboCop Immunity', () => {
    it('should produce identical SHA-256 fingerprints despite comments, blank lines, and whitespace differences', () => {
      const formattedCodeA = `class OrdersController
  def index
    # Fetch all orders for current user
    @orders = Order.all
    render json: @orders # return JSON
  end
end`;

      const formattedCodeB = `class OrdersController

  def index
    @orders = Order.all
    render json: @orders
  end

end`;

      const resultA = parser.parse('orders_controller.rb', formattedCodeA, 'OrdersController#index');
      const resultB = parser.parse('orders_controller.rb', formattedCodeB, 'OrdersController#index');

      expect(resultA.found).toBe(true);
      expect(resultB.found).toBe(true);
      expect(resultA.fingerprint).toBe(resultB.fingerprint);
    });

    it('should produce identical fingerprints for entire file regardless of comments and indentation variations', () => {
      const fileA = `# frozen_string_literal: true
# Top level comment
module Billing
  # Class comment
  class Invoice
    def process
      true # comment
    end
  end
end`;

      const fileB = `module Billing
  class Invoice
    def process
      true
    end
  end
end`;

      const resultA = parser.parse('billing.rb', fileA);
      const resultB = parser.parse('billing.rb', fileB);

      expect(resultA.found).toBe(true);
      expect(resultB.found).toBe(true);
      expect(resultA.fingerprint).toBe(resultB.fingerprint);
    });
  });

  describe('ParserDispatcher Integration', () => {
    it('should dispatch .rb files to RubyParser', async () => {
      const dispatcher = new ParserDispatcher();
      const parserResolved = dispatcher.getParserForFile('app/services/payment_service.rb');

      expect(parserResolved).toBeInstanceOf(RubyParser);

      const parseResult = await dispatcher.parse('app/models/invoice.rb', sampleRubyCode, 'Invoice');
      expect(parseResult.found).toBe(true);
      expect(parseResult.rawMatchedContent).toContain('class Invoice < ApplicationRecord');
    });
  });

  describe('findSymbols', () => {
    it('should list all symbols including classes, modules, and methods with accurate line numbers', () => {
      const symbols = parser.findSymbols('sample.rb', sampleRubyCode);

      const symbolNames = symbols.map((s) => s.name);
      expect(symbolNames).toContain('Billing');
      expect(symbolNames).toContain('Billing::Invoice');
      expect(symbolNames).toContain('Billing::Invoice::notify');
      expect(symbolNames).toContain('Billing::Invoice#process');
      expect(symbolNames).toContain('OrdersController');
      expect(symbolNames).toContain('OrdersController#index');
      expect(symbolNames).toContain('OrdersController::notify');
    });
  });
});
