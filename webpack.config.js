const htmlPlugin = require('html-webpack-plugin');
const copyWebpackPlugin = require('copy-webpack-plugin');
var webpack = require('webpack');
var path = require('path');

module.exports = {
  context: __dirname,
  entry: {
    'main': './main.js'
  },
  output: {
    path: path.join(__dirname, 'dist/'),
    publicPath: './',
    filename: '[name].js'
  },

  resolve: {
    extensions: ['.js'],
    alias: {
      '$': 'jQuery'
    }
  },

  plugins: [
    new htmlPlugin({
        title: 'Embeddable Player',
        filename: 'index.html',
        template: 'index.html'
    }),
    new webpack.optimize.UglifyJsPlugin({
      compressor: {
        screw_ie8: true,
        warnings: false
      }
    }),
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery'
    }),
    new copyWebpackPlugin([
      {from: 'lib'}
    ])
  ]
};