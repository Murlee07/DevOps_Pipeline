'use strict';

const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

function validateRegister(body = {}) {
  const errors = {};
  const { name, email, password } = body;
  if (!isNonEmptyString(name) || name.trim().length > 80) {
    errors.name = 'Name is required (max 80 characters).';
  }
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email.trim())) {
    errors.email = 'A valid email address is required.';
  }
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    errors.password = 'Password must be 8-128 characters and contain a letter and a number.';
  }
  return errors;
}

function validateLogin(body = {}) {
  const errors = {};
  if (typeof body.email !== 'string' || !body.email.trim()) errors.email = 'Email is required.';
  if (typeof body.password !== 'string' || !body.password) errors.password = 'Password is required.';
  return errors;
}

/**
 * Validates task input. When `partial` is true (PATCH), only provided fields are checked.
 * Returns { errors, value } where value contains only sanitized, known fields.
 */
function validateTask(body = {}, { partial = false } = {}) {
  const errors = {};
  const value = {};

  if (!partial || body.title !== undefined) {
    if (!isNonEmptyString(body.title) || body.title.trim().length > 120) {
      errors.title = 'Title is required (max 120 characters).';
    } else {
      value.title = body.title.trim();
    }
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string' || body.description.length > 2000) {
      errors.description = 'Description must be text (max 2000 characters).';
    } else {
      value.description = body.description.trim();
    }
  } else if (body.description === null) {
    value.description = '';
  }

  if (body.status !== undefined) {
    if (STATUSES.includes(body.status)) value.status = body.status;
    else errors.status = `Status must be one of: ${STATUSES.join(', ')}.`;
  }

  if (body.priority !== undefined) {
    if (PRIORITIES.includes(body.priority)) value.priority = body.priority;
    else errors.priority = `Priority must be one of: ${PRIORITIES.join(', ')}.`;
  }

  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === '') {
      value.dueDate = null;
    } else if (typeof body.dueDate === 'string' && DATE_RE.test(body.dueDate) && !Number.isNaN(Date.parse(body.dueDate))) {
      value.dueDate = body.dueDate;
    } else {
      errors.dueDate = 'Due date must be in YYYY-MM-DD format.';
    }
  }

  if (partial && Object.keys(value).length === 0 && Object.keys(errors).length === 0) {
    errors.body = 'No updatable fields provided.';
  }

  return { errors, value };
}

module.exports = { validateRegister, validateLogin, validateTask, STATUSES, PRIORITIES };
