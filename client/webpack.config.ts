const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const dotenv = require('dotenv')

const HTMLWebpackPluginConfig = new HtmlWebpackPlugin({
  template: __dirname + '/src/index.html',
  filename: 'index.html',
  favicon: __dirname + '/src/assets/chrono.svg',
})

function buildConfig(env, argv) {
  const isDev = argv.mode === 'development'
  if (isDev) {
    // Load the environment variables from the .env file
    dotenv.config({ path: path.resolve(__dirname, '../.env') })
  }

  const definePlugin = new webpack.DefinePlugin({
    ENABLE_MONTHLY_VIEW: false,
    ENABLE_EMAIL_LOGIN: false,
    'process.env.API_URL': JSON.stringify(process.env.API_URL),
  })

  return {
    entry: './src/app.tsx',
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.scss'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.(scss|css)$/,
          use: [
            'style-loader', // creates style nodes from JS strings
            'css-loader', // translates CSS into CommonJS
            'sass-loader', // compiles Sass to CSS
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
        },
      ],
    },
    devtool: 'inline-source-map',
    plugins: [HTMLWebpackPluginConfig, definePlugin],
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].bundle.js',
      publicPath: '/',
    },
    devServer: {
      historyApiFallback: true,
      static: {
        directory: path.join(__dirname, 'dist'),
      },
    },
    optimization: {
      runtimeChunk: 'single',
    },
  }
}

module.exports = buildConfig
