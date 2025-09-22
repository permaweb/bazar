import { applyMiddleware, combineReducers, compose, legacy_createStore as createStore } from 'redux';
import { persistReducer, persistStore } from 'redux-persist';
import thunk from 'redux-thunk';

import { collectionsReducer } from './collections/reducers';
import { currenciesReducer } from './currencies/reducers';
import { profilesReducer } from './profiles/reducers';
import { stampsReducer } from './stamps/reducers';
import { streaksReducer } from './streaks/reducers';
import { ucmReducer } from './ucm/reducers';
import { safeStorage } from './utils/safeStorage';

declare const window: any;

const persistConfig = {
	key: 'root',
	storage: safeStorage,
	blacklist: [],
};

const rootReducer = combineReducers({
	collectionsReducer,
	currenciesReducer,
	profilesReducer,
	stampsReducer,
	streaksReducer,
	ucmReducer,
});

export type RootState = ReturnType<typeof store.getState>;
const persistedReducer = persistReducer<any, any>(persistConfig, rootReducer);

let composedEnhancer: any;
if (window.__REDUX_DEVTOOLS_EXTENSION__) {
	composedEnhancer = compose(
		applyMiddleware(thunk),
		window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
	);
} else {
	composedEnhancer = compose(applyMiddleware(thunk));
}

export type AppDispatch = typeof store.dispatch;
export const store = createStore(persistedReducer, composedEnhancer);
export const persistor = persistStore(store);
