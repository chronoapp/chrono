const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')

const HTMLWebpackPluginConfig = new HtmlWebpackPlugin({
  template: __dirname + '/src/index.html',
  filename: 'index.html',
  favicon: __dirname + '/src/assets/chrono.svg',
})

const definePlugin = new webpack.DefinePlugin({
  MONTHLY_VIEW_ENABLED: false,
})

function buildConfig(env) {
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
