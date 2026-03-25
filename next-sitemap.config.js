/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://meritusvia.com",
  generateRobotsTxt: false,
  exclude: ["/credentials"],
  changefreq: "weekly",
  priority: 0.7,
  transform: async (config, path) => {
    const priorities = {
      "/": 1.0,
      "/services": 0.9,
      "/approach": 0.8,
      "/technology": 0.8,
      "/about": 0.7,
      "/contact": 0.7,
      "/insights": 0.8,
    };
    return {
      loc: path,
      changefreq: config.changefreq,
      priority: priorities[path] || config.priority,
      lastmod: new Date().toISOString(),
    };
  },
};
