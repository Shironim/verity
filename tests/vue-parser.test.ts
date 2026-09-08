import { describe, expect, it } from 'bun:test';
import { VueSfcParser } from '../src/core/parser/mixed/vue';

const sampleVueComponent = `
<template>
  <div class="user-card">
    <h2>{{ title }}</h2>
    <button @click="handleClick" @submit.prevent="handleSubmit">Save</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  title: string;
  count?: number;
}>();

const emit = defineEmits<{
  (e: 'save', id: number): void;
  (e: 'close'): void;
}>();

const counter = ref(0);

function handleClick() {
  counter.value++;
  emit('save', counter.value);
}

function handleSubmit() {
  emit('close');
}
</script>
`;

describe('VueSfcParser', () => {
  const parser = new VueSfcParser();

  it('should parse entire Vue SFC when no target symbol is specified', () => {
    const result = parser.parse('UserCard.vue', sampleVueComponent);
    expect(result.found).toBe(true);
    expect(result.fingerprint).toBeDefined();
    expect(result.fingerprint.length).toBe(64);
  });

  it('should extract specific functions from script setup', () => {
    const resultClick = parser.parse('UserCard.vue', sampleVueComponent, 'handleClick');
    expect(resultClick.found).toBe(true);
    expect(resultClick.rawMatchedContent).toContain('counter.value++');

    const resultSubmit = parser.parse('UserCard.vue', sampleVueComponent, 'handleSubmit');
    expect(resultSubmit.found).toBe(true);
    expect(resultSubmit.rawMatchedContent).toContain("emit('close')");
  });

  it('should extract defineProps contract', () => {
    const result = parser.parse('UserCard.vue', sampleVueComponent, 'defineProps');
    expect(result.found).toBe(true);
    expect(result.rawMatchedContent).toContain('title: string');

    const resultAlias = parser.parse('UserCard.vue', sampleVueComponent, 'props');
    expect(resultAlias.found).toBe(true);
    expect(resultAlias.fingerprint).toBe(result.fingerprint);
  });

  it('should extract defineEmits contract', () => {
    const result = parser.parse('UserCard.vue', sampleVueComponent, 'defineEmits');
    expect(result.found).toBe(true);
    expect(result.rawMatchedContent).toContain("(e: 'save'");

    const resultAlias = parser.parse('UserCard.vue', sampleVueComponent, 'emits');
    expect(resultAlias.found).toBe(true);
    expect(resultAlias.fingerprint).toBe(result.fingerprint);
  });

  it('should extract template event bindings', () => {
    const resultAllEvents = parser.parse('UserCard.vue', sampleVueComponent, 'events');
    expect(resultAllEvents.found).toBe(true);
    expect(resultAllEvents.rawMatchedContent).toContain('@click="handleClick"');

    const resultClickEvent = parser.parse('UserCard.vue', sampleVueComponent, '@click');
    expect(resultClickEvent.found).toBe(true);
    expect(resultClickEvent.rawMatchedContent).toContain('@click="handleClick"');
  });

  it('should discover all symbols including script methods, props, emits, and events', () => {
    const symbols = parser.findSymbols('UserCard.vue', sampleVueComponent);
    const names = symbols.map((s) => s.name);

    expect(names).toContain('handleClick');
    expect(names).toContain('handleSubmit');
    expect(names).toContain('defineProps');
    expect(names).toContain('defineEmits');
    expect(names).toContain('@click');
    expect(names).toContain('@submit');
  });

  it('should return found: false when requested symbol does not exist', () => {
    const result = parser.parse('UserCard.vue', sampleVueComponent, 'nonExistentFunction');
    expect(result.found).toBe(false);
    expect(result.fingerprint).toBe('');
  });
});
