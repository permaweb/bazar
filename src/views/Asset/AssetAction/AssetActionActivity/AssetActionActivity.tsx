import React from 'react';

import { readHandler } from 'api';

import { AO } from 'helpers/config';

import { IProps } from './types';

export default function AssetActionActivity(props: IProps) {
	React.useEffect(() => {
		(async function () {
			if (props.asset && props.asset.data && props.asset.data.id) {
				try {
					const response = await readHandler({
						processId: AO.ucm,
						action: 'Get-Activity',
						data: {
							AssetIds: [props.asset.data.id],
						},
					});

					if (response) {
						console.log(response);
					}
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [props.asset]);

	return <p>Coming soon!</p>;
}
