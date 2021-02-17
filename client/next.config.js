const withSass = require('@zeit/next-sass')

module.exports = withSass({
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:8888/api/v1/:path*', // Proxy to Backend
      },
    ]
  },
})
