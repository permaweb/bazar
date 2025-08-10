const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const productionAddresses = {
	MODULE: 'Pq2Zftrqut0hdisH_MC2pDOT6S4eQFoxGsFUzR6r350',
	SCHEDULER: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
	DEFAULT_TOKEN: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
	UCM: 'hqdL4AZaFZ0huQHbAsYxdTwG6vpibK7ALWKNzmWaD4Q',
	UCM_ACTIVITY: '7_psKu3QHwzc2PFCJk2lEwyitLJbz6Vj7hOcltOulj4',
	PIXL: 'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo',
	PROFILE_REGISTRY: 'SNy4m-DrqxWl01YqGM4sxI8qCni-58re8uuJLvZPypY',
	PROFILE_SRC: '_R2XYWDPUXVvQrQKFaQRvDTDcDwnQNbqlTd_qvCRSpQ',
	COLLECTIONS_REGISTRY: 'Kv6jQCcs8GwNpioj6tkTt06zD130YgqIHX7QNnZQYQc',
	VOUCH: 'ZTTO02BL2P-lseTLUgiIPD9d0CF1sc4LbMA2AQ7e9jo',
	STAMPS: 'LaC2VtxqGekpRPuJh-TkI_ByAqCS2_KB3YuhMJ5yBtc',
};

const nonProductionAddresses = {
	MODULE: 'Pq2Zftrqut0hdisH_MC2pDOT6S4eQFoxGsFUzR6r350',
	SCHEDULER: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
	DEFAULT_TOKEN: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
	UCM: 'CDxd81DDaJvpzxoyhXn-dVnZhYIFQEKU8FeUHdktFgQ',
	UCM_ACTIVITY: 'W45ki8vJ0TcsxZAGZIbGj3k38595TA0HfZwCOaqhOa0',
	PIXL: 'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo',
	PROFILE_REGISTRY: 'SNy4m-DrqxWl01YqGM4sxI8qCni-58re8uuJLvZPypY',
	PROFILE_SRC: '9Tpz5_ZT4RRkF-6JUTdaaTMg0ARfkNuuM5zahXyCqZ4',
	COLLECTIONS_REGISTRY: '1oBtIRAmhLVJFABGKYlhcsACjyh36ahSJ-4lJEuvgzA',
	VOUCH: 'ZTTO02BL2P-lseTLUgiIPD9d0CF1sc4LbMA2AQ7e9jo',
	STAMPS: 'LaC2VtxqGekpRPuJh-TkI_ByAqCS2_KB3YuhMJ5yBtc',
};

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';
const isStaging = env === 'staging';

const addresses = isProduction ? productionAddresses : isStaging ? nonProductionAddresses : productionAddresses;

module.exports = {
	entry: './src/index.tsx',
	output: {
		path: `${__dirname}/dist`,
		filename: 'bundle.js',
	},
	devtool: 'eval',
	mode: isProduction ? 'production' : 'development',
	devServer: {
		static: {
			directory: path.join(__dirname, 'dist'),
		},
		hot: true,
		historyApiFallback: true,
		port: 3000,
		open: false,
		compress: true,
		client: {
			overlay: true,
		},
	},
	optimization: isProduction
		? {
				minimize: true,
				minimizer: [
					new TerserPlugin({
						extractComments: false,
					}),
				],
				usedExports: true,
		  }
		: {},
	ignoreWarnings: [
		{
			message:
				/Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
		},
		{
			message: /There are multiple modules with names that only differ in casing./,
		},
	],
	module: {
		rules: [
			{
				test: /\.md$/,
				use: 'raw-loader',
			},
			{
				test: /\.(ts|tsx)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							'@babel/preset-env',
							['@babel/preset-react', { runtime: 'automatic' }],
							'@babel/preset-typescript',
						],
					},
				},
			},
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader'],
			},
			{
				test: /\.m?js/,
				resolve: {
					fullySpecified: false,
				},
			},
			{
				test: /\.(png|jpg|gif|riv)$/,
				use: [
					'url-loader',
					// Temporarily disabled image optimization to fix build errors
					// {
					// 	loader: 'image-webpack-loader',
					// 	options: {
					// 		mozjpeg: {
					// 			progressive: true,
					// 			quality: 65,
					// 		},
					// 		optipng: {
					// 			enabled: false,
					// 		},
					// 		pngquant: {
					// 			quality: [0.65, 0.9],
					// 			speed: 4,
					// 		},
					// 		gifsicle: {
					// 			interlaced: false,
					// 		},
					// 		webp: {
					// 			quality: 75,
					// 		},
					// 	},
					// },
				],
			},
			{
				test: /\.svg$/,
				use: [
					{
						loader: '@svgr/webpack',
						options: {
							icon: true,
						},
					},
					'url-loader',
				],
			},
		],
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: path.join(__dirname, 'public', 'index.html'),
		}),
		new CopyWebpackPlugin({
			patterns: [
				{ from: 'public/favicon.svg', to: 'favicon.svg' },
				{ from: 'public/manifest.json', to: 'manifest.json' },
			],
		}),
		new CleanWebpackPlugin(),
		new webpack.ProvidePlugin({
			process: 'process/browser',
			Buffer: ['buffer', 'Buffer'],
			'window.setImmediate': [require.resolve('timers'), 'setImmediate'],
			'global.setImmediate': [require.resolve('timers'), 'setImmediate'],
		}),
		new webpack.NoEmitOnErrorsPlugin(),
		new webpack.DefinePlugin({
			'process.env.MODULE': JSON.stringify(addresses.MODULE),
			'process.env.SCHEDULER': JSON.stringify(addresses.SCHEDULER),
			'process.env.DEFAULT_TOKEN': JSON.stringify(addresses.DEFAULT_TOKEN),
			'process.env.UCM': JSON.stringify(addresses.UCM),
			'process.env.UCM_ACTIVITY': JSON.stringify(addresses.UCM_ACTIVITY),
			'process.env.PIXL': JSON.stringify(addresses.PIXL),
			'process.env.PROFILE_REGISTRY': JSON.stringify(addresses.PROFILE_REGISTRY),
			'process.env.PROFILE_SRC': JSON.stringify(addresses.PROFILE_SRC),
			'process.env.COLLECTIONS_REGISTRY': JSON.stringify(addresses.COLLECTIONS_REGISTRY),
			'process.env.VOUCH': JSON.stringify(addresses.VOUCH),
			'process.env.STAMPS': JSON.stringify(addresses.STAMPS),
		}),
		new webpack.ProvidePlugin({
			Buffer: ['buffer', 'Buffer'],
		}),
	],
	resolve: {
		extensions: ['.tsx', '.ts', '.jsx', '.js'],
		preferRelative: true,
		fallback: {
			fs: false,
			tls: false,
			net: false,
			path: require.resolve('path-browserify'),
			zlib: require.resolve('browserify-zlib'),
			http: require.resolve('stream-http'),
			https: require.resolve('https-browserify'),
			events: require.resolve('events/'),
			crypto: require.resolve('crypto-browserify'),
			stream: require.resolve('stream-browserify'),
			process: require.resolve('process/browser'),
			constants: require.resolve('constants-browserify'),
			os: require.resolve('os-browserify'),
			util: require.resolve('util'),
			assert: require.resolve('assert'),
			url: require.resolve('url'),
			buffer: require.resolve('buffer'),
			timers: require.resolve('timers-browserify'),
		},
		alias: {
			react: path.resolve(__dirname, 'node_modules/react'),
			process: 'process/browser',
			api: path.resolve(__dirname, 'src/api/'),
			app: path.resolve(__dirname, 'src/app/'),
			arweave: path.resolve(__dirname, 'node_modules/arweave'),
			assets: path.resolve(__dirname, 'src/assets/'),
			components: path.resolve(__dirname, 'src/components/'),
			helpers: path.resolve(__dirname, 'src/helpers/'),
			hooks: path.resolve(__dirname, 'src/hooks/'),
			navigation: path.resolve(__dirname, 'src/navigation/'),
			providers: path.resolve(__dirname, 'src/providers/'),
			root: path.resolve(__dirname, 'src/root/'),
			routes: path.resolve(__dirname, 'src/routes/'),
			store: path.resolve(__dirname, 'src/store/'),
			views: path.resolve(__dirname, 'src/views/'),
			wallet: path.resolve(__dirname, 'src/wallet/'),
			wrappers: path.resolve(__dirname, 'src/wrappers/'),
			'asn1.js': path.resolve(__dirname, 'node_modules/asn1.js'),
			elliptic: path.resolve(__dirname, 'node_modules/elliptic'),
			'node:buffer': require.resolve('buffer/'),
		},
	},
	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'dist'),
	},
};
