'use strict';

const { validateRegister, validateTask } = require('../src/utils/validate');

describe('validateRegister', () => {
  test('accepts valid input', () => {
    expect(validateRegister({ name: 'Murali', email: 'm@example.com', password: 'abcd1234' })).toEqual({});
  });

  test('requires letters and numbers in password', () => {
    expect(validateRegister({ name: 'A', email: 'a@b.co', password: 'abcdefgh' }).password).toBeDefined();
    expect(validateRegister({ name: 'A', email: 'a@b.co', password: '12345678' }).password).toBeDefined();
  });

  test('handles missing body', () => {
    expect(Object.keys(validateRegister())).toHaveLength(3);
  });
});

describe('validateTask', () => {
  test('strips unknown fields', () => {
    const { errors, value } = validateTask({ title: 'Hi', userId: 'evil', id: 'x' });
    expect(errors).toEqual({});
    expect(value).toEqual({ title: 'Hi' });
  });

  test('partial update accepts single field', () => {
    const { errors, value } = validateTask({ priority: 'low' }, { partial: true });
    expect(errors).toEqual({});
    expect(value).toEqual({ priority: 'low' });
  });

  test('rejects impossible dates', () => {
    expect(validateTask({ title: 'x', dueDate: '2026-13-45' }).errors.dueDate).toBeDefined();
  });

  test('accepts empty due date as null', () => {
    expect(validateTask({ title: 'x', dueDate: '' }).value.dueDate).toBeNull();
  });
});
