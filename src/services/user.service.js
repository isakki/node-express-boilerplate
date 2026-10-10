const httpStatus = require('http-status');
const moment = require('moment');
const config = require('../config/config');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  return User.create(userBody);
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async (filter, options) => {
  const users = await User.paginate(filter, options);
  return users;
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
  return User.findById(id);
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
  return User.findOne({ email });
};

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(user, updateBody);
  await user.save();
  return user;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await user.remove();
  return user;
};

/**
 * Record a failed login attempt and lock the account once the limit is reached.
 * The counter is incremented atomically so that concurrent attempts are all counted.
 * @param {ObjectId} userId
 * @returns {Promise}
 */
const recordFailedLogin = async (userId) => {
  const user = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { failedLoginAttempts: 1 } },
    { new: true, useFindAndModify: false }
  );
  if (user && user.failedLoginAttempts >= config.login.maxFailedAttempts) {
    const lockUntil = moment().add(config.login.lockMinutes, 'minutes').toDate();
    await User.updateOne({ _id: userId }, { $set: { lockUntil, failedLoginAttempts: 0 } });
  }
};

/**
 * Clear the failed login counter and any lock
 * @param {ObjectId} userId
 * @returns {Promise}
 */
const resetFailedLogins = async (userId) => {
  await User.updateOne({ _id: userId }, { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: '' } });
};

module.exports = {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
  recordFailedLogin,
  resetFailedLogins,
};
