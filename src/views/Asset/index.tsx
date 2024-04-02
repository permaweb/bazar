import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getAssetById } from 'api';

import { Loader } from 'components/atoms/Loader';
import { URLS } from 'helpers/config';
import { AssetDetailType } from 'helpers/types';
import { checkValidAddress } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import { AssetAction } from './AssetAction';
import { AssetInfo } from './AssetInfo';
import * as S from './styles';

export default function Asset() {
	const navigate = useNavigate();
	const { id } = useParams();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [asset, setAsset] = React.useState<AssetDetailType | null>(null);
	const [loading, setLoading] = React.useState<boolean>(false);
	const [errorResponse, setErrorResponse] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async function () {
			if (id && checkValidAddress(id)) {
				setLoading(true);
				try {
					setAsset(await getAssetById({ id: id }));
				} catch (e: any) {
					setErrorResponse(e.message || language.assetFetchFailed);
				}
				setLoading(false);
			} else navigate(URLS.base); // TODO redirect 404
		})();
	}, [id]);

	function getData() {
		if (asset) {
			return (
				<>
					<S.InfoWrapper>
						<AssetInfo asset={asset} />
					</S.InfoWrapper>
					<S.ActionWrapper>
						<AssetAction asset={asset} />
					</S.ActionWrapper>
				</>
			);
		} else {
			if (loading) return <Loader />;
			else if (errorResponse) return <p>{errorResponse}</p>;
			else return null;
		}
	}

	return <S.Wrapper>{getData()}</S.Wrapper>;
}
