const { validateReleaseConfig } = require('./scripts/release-config.cjs');
module.exports = ({ config }) => {
  if (process.env.APP_ENV === 'production' || process.env.EAS_BUILD_PROFILE === 'production') validateReleaseConfig();
  return config;
};
