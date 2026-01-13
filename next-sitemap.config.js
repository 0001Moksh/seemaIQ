/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.SITE_URL || 'https://seemaiq.com',
  generateRobotsTxt: true,
  sitemapSize: 50000,
  changefreq: 'daily',
  priority: 0.7,
  exclude: ['/api/*', '/auth/*'],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
      },
    ],
    additionalSitemaps: [
      'https://seemaiq.com/sitemap.xml',
    ],
  },
};

module.exports = config;
