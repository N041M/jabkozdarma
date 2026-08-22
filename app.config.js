// Extends app.json. EXPO_BASE_PATH lets CI export the web build for
// subpath hosting (GitHub Pages serves at /<repo>/); local dev leaves it unset.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_BASE_PATH || undefined,
  },
});
