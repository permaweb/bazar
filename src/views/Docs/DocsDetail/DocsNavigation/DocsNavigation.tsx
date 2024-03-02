import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { APP, ASSETS, STYLING, URLS } from 'helpers/config';
import * as windowUtils from 'helpers/window';
import { useLanguageProvider } from 'providers/LanguageProvider';

import { docsOrder } from '../order-docs';

import * as S from './styles';

function renderNavItems(handleClick: any, path = '', docs: any = docsOrder) {
	const location = useLocation();
	const basePath = URLS.docs;
	const active = location.pathname.replace(basePath, '');

	const items = [];
	for (let i = 0; i < docs.length; i++) {
		if (docs[i].path && !docs[i].children) {
			const fullPath = `${path ? path + '/' : path}${docs[i].path}`;
			items.push(
				<Link to={`${URLS.docs}${fullPath}`} key={`file-${docs[i].path}`} onClick={handleClick ? handleClick : null}>
					<S.NListItem disabled={false} active={fullPath === active}>
						{docs[i].name}
					</S.NListItem>
				</Link>
			);
		} else {
			if (docs[i].children) {
				items.push(
					<S.NGroup key={`dir-${docs[i].name}`}>
						<S.NSubHeader>
							<p>{docs[i].name}</p>
						</S.NSubHeader>
						<S.NSubList>{renderNavItems(handleClick || null, docs[i].path, docs[i].children)}</S.NSubList>
					</S.NGroup>
				);
			}
		}
	}

	return items;
}

export default function DocsNavigation() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [open, setOpen] = React.useState(windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.initial)));
	const [desktop, setDesktop] = React.useState(windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.initial)));

	function handleWindowResize() {
		if (windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.initial))) {
			setDesktop(true);
			setOpen(true);
		} else {
			setDesktop(false);
			setOpen(false);
		}
	}

	windowUtils.checkWindowResize(handleWindowResize);

	function getNav() {
		const Title: any = desktop ? S.NTitle : S.NTitleMobile;

		return (
			<S.NWrapper>
				<S.NContent className={'border-wrapper-alt1 scroll-wrapper'}>
					<Title onClick={desktop ? () => {} : () => setOpen(!open)} open={open}>
						<p>
							{APP.name} {language.learn}
						</p>
						{!desktop && <ReactSVG src={ASSETS.arrow} />}
					</Title>
					<S.NList>{open && renderNavItems(desktop ? null : () => setOpen(false))}</S.NList>
				</S.NContent>
			</S.NWrapper>
		);
	}

	return getNav();
}
