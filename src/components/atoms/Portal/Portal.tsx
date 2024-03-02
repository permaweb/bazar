import React from 'react';
import ReactDOM from 'react-dom';

import { IProps } from './types';

export default function Portal(props: IProps) {
	const [DOM, setDOM] = React.useState<boolean>(false);
	React.useEffect(() => {
		setDOM(true);
	}, []);
	return DOM && document.getElementById(props.node)
		? ReactDOM.createPortal(props.children, document.getElementById(props.node)!)
		: null;
}
