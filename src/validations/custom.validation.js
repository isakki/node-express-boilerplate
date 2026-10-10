const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message('"{{#label}}" must be a valid mongo id');
  }
  return value;
};

const password = (value, helpers) => {
  if (value.length < 8) {
    return helpers.message('password must be at least 8 characters');
  }
  if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
    return helpers.message('password must contain at least 1 letter and 1 number');
  }
  return value;
};

/**
 * Build a validator for the sortBy query param, in the format: field[:(asc|desc)], separated by commas.
 * The order is optional and defaults to asc
 * Only the given fields may be sorted on, so private fields such as password can never be used
 * @param {string[]} allowedFields
 * @returns {Function}
 */
const sortBy = (allowedFields) => (value, helpers) => {
  const isValid = value.split(',').every((sortOption) => {
    const [field, order, ...rest] = sortOption.split(':');
    return (
      rest.length === 0 && allowedFields.includes(field) && (order === undefined || order === 'asc' || order === 'desc')
    );
  });
  if (!isValid) {
    return helpers.message(
      `"{{#label}}" must be a comma separated list of field[:(asc|desc)], using only: ${allowedFields.join(', ')}`
    );
  }
  return value;
};

module.exports = {
  objectId,
  password,
  sortBy,
};
