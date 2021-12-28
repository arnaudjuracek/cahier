
const path = require('path')
const webpack = require('webpack')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const RemovePlugin = require('remove-files-webpack-plugin')

const isProduction = (process.env.NODE_ENV === 'production')

module.exports = {
  entry: [
    path.join(__dirname, 'src', 'index.js'),
    path.join(__dirname, 'src', 'index.scss')
  ],

  output: {
    publicPath: '/',
    filename: 'bundle.js',
    path: path.join(__dirname, isProduction ? 'build' : 'src')
  },

  resolve: {
    alias: {
      components: path.join(__dirname, 'src', 'components'),
      controllers: path.join(__dirname, 'src', 'controllers'),
      store: path.join(__dirname, 'src', 'store'),
      utils: path.join(__dirname, 'src', 'utils')
    }
  },

  module: {
    rules: [
      {
        test: /\.(js)$/,
        loader: 'babel-loader',
        include: path.join(__dirname, 'src')
      },
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        loader: 'ifdef-loader',
        options: { DEVELOPMENT: !isProduction }
      },
      {
        test: /\.(scss)$/,
        use: [
          (isProduction
            ? { loader: MiniCssExtractPlugin.loader }
            : { loader: 'style-loader', options: { sourceMap: true } }
          ),
          {
            loader: 'css-loader',
            options: {
              url: false,
              sourceMap: true,
              minimize: isProduction
            }
          },
          {
            loader: 'sass-loader',
            options: { sourceMap: true }
          }
        ],
        include: path.join(__dirname, 'src')
      }
    ]
  },

  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? 'source-map' : 'eval-source-map',

  optimization: {
    minimize: isProduction
  },

  plugins: [
    new webpack.ProvidePlugin({
      h: [path.join(__dirname, 'src', 'utils', 'jsx'), 'h']
    }),
    ...(isProduction
      ? [
        new RemovePlugin({ before: { include: [path.join(__dirname, 'build')] } }),
        new MiniCssExtractPlugin({ filename: 'bundle.css' }),
        new webpack.DefinePlugin({ 'process.env': { NODE_ENV: '"production"' } }),
        new webpack.optimize.OccurrenceOrderPlugin()
      ]
      : [
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoEmitOnErrorsPlugin()
      ]
    )
  ]
}
