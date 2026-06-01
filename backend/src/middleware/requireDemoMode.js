const requireDemoMode = (req, res, next) => {
  if (process.env.DEMO_MODE !== 'true') {
    return res.status(404).json({ message: 'Not found' });
  }
  next();
};

module.exports = requireDemoMode;
