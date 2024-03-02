import { DocsNavigation } from './DocsNavigation';
import { DocTemplate } from './DocTemplate';
import * as S from './styles';

export default function DocsDetail() {
	return (
		<S.Wrapper>
			<S.BodyWrapper>
				<DocsNavigation />
				<DocTemplate />
			</S.BodyWrapper>
		</S.Wrapper>
	);
}
