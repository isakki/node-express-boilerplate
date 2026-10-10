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
 * Reserve a login attempt for a user, before the password is checked.
 * The attempt is counted with a single conditional update, so no more than the configured number
 * of password checks can run per lock window, however many requests arrive in parallel.
 * A successful login must call resetFailedLogins to release the reserved attempts.
 * @param {ObjectId} userId
 * @returns {Promise<boolean>} false if the account is locked and the password must not be checked
 */
const reserveLoginAttempt = async (userId) => {
  const { maxFailedAttempts, lockMinutes } = config.login;

  // start a new window if the previous one has expired
  await User.updateOne(
    { _id: userId, lockUntil: { $lte: new Date() } },
    { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: '' } }
  );

  const user = await User.findOneAndUpdate(
    { _id: userId, failedLoginAttempts: { $not: { $gte: maxFailedAttempts } } },
    { $inc: { failedLoginAttempts: 1 }, $set: { lockUntil: moment().add(lockMinutes, 'minutes').toDate() } },
    { new: true, useFindAndModify: false }
  );
  return !!user;
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
  reserveLoginAttempt,
  resetFailedLogins,
};
