// lib/seo-config.ts
export const seoConfig = {
  siteUrl: "https://seemaiq.com",
  siteName: "SeemaIQ",
  siteTitle: "SeemaIQ – AI Interview Simulator",
  siteDescription:
    "Master your interview skills with AI-powered practice sessions. Practice coding interviews, system design, HR rounds, and behavioral questions with AI-powered feedback.",
  authorName: "Moksh Bhardwaj",
  authorUrl: "https://mokshbhardwaj.netlify.app/",
  twitterHandle: "@seemaiq",
  locale: "en_US",
  ogImage: "/logo_icon.png",
};

export const generateStructuredData = {
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: seoConfig.siteName,
    url: seoConfig.siteUrl,
    logo: `${seoConfig.siteUrl}/logo_icon.png`,
    description: seoConfig.siteDescription,
    sameAs: [
      "https://twitter.com/seemaiq",
      "https://linkedin.com/company/seemaiq",
    ],
  },
  webSite: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: seoConfig.siteUrl,
    name: seoConfig.siteTitle,
    description: seoConfig.siteDescription,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${seoConfig.siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  },
  softwareApplication: {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: seoConfig.siteName,
    description: seoConfig.siteDescription,
    url: seoConfig.siteUrl,
    applicationCategory: "EducationalApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Person",
      name: seoConfig.authorName,
      url: seoConfig.authorUrl,
    },
  },
};
