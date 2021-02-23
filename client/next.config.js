const path = require('path')

module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:8888/api/v1/:path*', // Proxy to Backend
      },
    ]
  },
  sassOptions: {
    includePaths: [path.join(__dirname, 'style')],
  },
}
