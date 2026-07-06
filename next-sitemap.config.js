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
      "/method": 0.85,
      "/sectors": 0.8,
      "/insights": 0.8,
      "/claims-intelligence": 0.75,
      "/contact": 0.75,
      "/insights/delay-analysis-adjudications": 0.7,
      "/insights/building-safety-act-remediation": 0.7,
      "/insights/ai-in-construction-disputes": 0.7,
      "/insights/proving-disruption-claims": 0.7,
      "/insights/smash-and-grab-true-value": 0.7,
      "/insights/expert-witness-independence": 0.7,
      "/privacy-policy": 0.3,
      "/terms": 0.3,
      "/accessibility": 0.3,
    };
    return {
      loc: path,
      changefreq: config.changefreq,
      priority: priorities[path] ?? config.priority,
      lastmod: new Date().toISOString(),
    };
  },
};
