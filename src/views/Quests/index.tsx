// Quests view temporarily disabled - this was from another branch
// Will be re-enabled when quests functionality is needed

import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
	padding: 2rem;
	text-align: center;
`;

const Title = styled.h1`
	font-size: 2rem;
	margin-bottom: 1rem;
	color: #333;
`;

const Description = styled.p`
	font-size: 1.1rem;
	color: #666;
	line-height: 1.5;
`;

export default function Quests() {
	return (
		<Container>
			<Title>Quests</Title>
			<Description>
				Quest system is temporarily disabled. This functionality was from another branch and will be re-enabled when
				needed.
			</Description>
		</Container>
	);
}
