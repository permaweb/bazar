import { DocTemplate } from './DocTemplate';
import { DocsNavigation } from './DocsNavigation';
import * as S from './styles';

export default function DocsDetail() {
	return (
		<div className={'max-view-wrapper'}>
			<S.Wrapper>
				<S.BodyWrapper>
					<DocsNavigation />
					<DocTemplate />
				</S.BodyWrapper>
			</S.Wrapper>
		</div>
	);
}
