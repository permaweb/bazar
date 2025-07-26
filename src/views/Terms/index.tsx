import React from 'react';

import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

export default function Terms() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	return (
		<S.Wrapper className={'max-view-wrapper'}>
			<S.Container>
				<S.Header>
					<h1>Terms of Service</h1>
					<p>Last updated: {new Date().toLocaleDateString()}</p>
				</S.Header>

				<S.Content>
					<S.Section>
						<h2>1. Acceptance of Terms</h2>
						<p>
							By accessing and using Bazar, you accept and agree to be bound by the terms and provision of this
							agreement. If you do not agree to abide by the above, please do not use this service.
						</p>
					</S.Section>

					<S.Section>
						<h2>2. What Bazar Is (and Isn't)</h2>
						<p>
							Bazar operates as a peer-to-peer web3 platform that helps users discover and directly interact with
							blockchain-based atomic assets on the Arweave network. Bazar is not a wallet provider, exchange, broker,
							dealer, financial institution, payments processor, money services business, or creditor.
						</p>
						<p>
							We do not have custody or control over the digital tokens, blockchains, or third parties you engage with,
							nor do we execute or facilitate purchases, transfers, or sales of atomic assets or other tokens.
						</p>
					</S.Section>

					<S.Section>
						<h2>3. User Responsibilities</h2>
						<p>As a user of Bazar, you agree to:</p>
						<ul>
							<li>Provide accurate and complete information when creating orders</li>
							<li>Maintain the security of your wallet and private keys</li>
							<li>Comply with all applicable laws and regulations</li>
							<li>Not engage in fraudulent or malicious activities</li>
							<li>Respect the intellectual property rights of others</li>
							<li>Conduct your own research (DYOR) before interacting with any atomic assets</li>
							<li>Not impersonate another person or entity</li>
							<li>Not use automated tools to manipulate the platform</li>
						</ul>
					</S.Section>

					<S.Section>
						<h2>4. Decentralized Content Disclaimer</h2>
						<p>
							Bazar operates as a decentralized platform where users can create and trade atomic assets.
							<strong>
								Bazar is not responsible for the creation, content, or purpose of any decentralized token collections.
							</strong>
							We have no control over what users create, why they create it, or the nature of the content they upload.
							All collections and assets are created independently by users, and Bazar serves only as a marketplace for
							their exchange.
						</p>
						<p>Users are solely responsible for:</p>
						<ul>
							<li>The content and legality of any collections they create</li>
							<li>Ensuring their collections comply with applicable laws and regulations</li>
							<li>The accuracy of any claims or representations made about their collections</li>
							<li>Resolving disputes with other users regarding their collections</li>
						</ul>
					</S.Section>

					<S.Section>
						<h2>5. Your Blockchain Identity</h2>
						<p>
							Your blockchain address serves as your identity on Bazar. Your Bazar account is linked to your blockchain
							address and displays the atomic assets associated with it. You are solely responsible for securing your
							wallet and keeping your credentials confidential.
						</p>
					</S.Section>

					<S.Section>
						<h2>6. Transaction Terms</h2>
						<p>
							All transactions on Bazar are executed on the Arweave network and are irreversible once confirmed. Users
							are responsible for verifying transaction details before confirming. The platform does not guarantee the
							value, authenticity, or legality of any assets traded.
						</p>
						<p>
							<strong>Blockchain Fees:</strong> You are responsible for all blockchain-related fees (gas fees), which
							are final and non-refundable.
						</p>
					</S.Section>

					<S.Section>
						<h2>7. Fees and Payments</h2>
						<p>
							Bazar may charge fees for certain transactions. All fees are clearly displayed before transaction
							confirmation. Users are responsible for paying all applicable fees and taxes.
						</p>
					</S.Section>

					<S.Section>
						<h2>8. Privacy and Data</h2>
						<p>
							Bazar operates on a decentralized network where transaction data is publicly visible on the blockchain. We
							do not collect or store personal information beyond what is necessary for platform functionality.
						</p>
					</S.Section>

					<S.Section>
						<h2>9. Third-Party Content and Services</h2>
						<p>
							The Platform may include links or access to third-party websites, applications, or other content. Bazar
							does not control, endorse, or review third-party content and is not responsible for it. You use
							third-party content entirely at your own risk.
						</p>
						<p>
							You must use a third-party wallet to engage in blockchain transactions. Bazar does not operate, maintain,
							or have any custody or control over wallets or their contents.
						</p>
					</S.Section>

					<S.Section>
						<h2>10. Age Restrictions</h2>
						<p>
							Users must be at least 18 years old to use Bazar. If you are between 13 and 18 years old, you may only use
							Bazar with a parent or guardian's account, provided they approve and oversee your use. Bazar strictly
							prohibits access by users under 13 years old.
						</p>
					</S.Section>

					<S.Section>
						<h2>11. Compliance with Laws</h2>
						<p>
							By using Bazar, you represent and warrant that you will comply with all applicable laws, including local,
							state, federal, and international regulations. You agree not to use the Platform if you are subject to
							sanctions or located in sanctioned jurisdictions.
						</p>
					</S.Section>

					<S.Section>
						<h2>12. Disclaimers</h2>
						<p>
							Bazar is provided "as is" without warranties of any kind. We disclaim all warranties, express or implied,
							including but not limited to warranties of merchantability, fitness for a particular purpose, and
							non-infringement.
						</p>
						<p>
							<strong>Experimental Technology:</strong> Bazar utilizes new, experimental, and innovative technologies
							including but not limited to the Arweave blockchain, atomic assets, and decentralized protocols. These
							technologies are rapidly evolving and may contain bugs, vulnerabilities, or other issues that could affect
							platform functionality, security, or user experience.
						</p>
						<p>Bazar does not guarantee:</p>
						<ul>
							<li>The uninterrupted or error-free operation of the Platform</li>
							<li>The accuracy or legality of atomic assets or content displayed on the Platform</li>
							<li>That the Platform will meet your expectations</li>
							<li>The security of the Platform against viruses, hacking, or other harmful elements</li>
							<li>The stability, reliability, or future development of underlying blockchain technologies</li>
							<li>Compatibility with future versions of blockchain protocols or atomic asset standards</li>
							<li>The continued availability or functionality of experimental features</li>
						</ul>
					</S.Section>

					<S.Section>
						<h2>13. Limitation of Liability</h2>
						<p>
							In no event shall Bazar or its developers be liable for any indirect, incidental, special, consequential,
							or punitive damages arising out of or relating to your use of the platform.
						</p>
					</S.Section>

					<S.Section>
						<h2>14. Assumption of Risk</h2>
						<p>By using Bazar, you acknowledge and accept the following risks:</p>
						<ul>
							<li>
								<strong>Asset Volatility:</strong> The value of atomic assets is subjective and highly volatile
							</li>
							<li>
								<strong>Blockchain Risks:</strong> Irreversible transactions and blockchain-related issues
							</li>
							<li>
								<strong>Ownership Disputes:</strong> Assets may be subject to ownership disputes
							</li>
							<li>
								<strong>Regulatory Risks:</strong> Uncertain regulatory landscape for blockchain technologies
							</li>
							<li>
								<strong>Tax Obligations:</strong> You are solely responsible for determining and paying applicable taxes
							</li>
							<li>
								<strong>Internet Security:</strong> Risks from internet disruptions and malicious attacks
							</li>
						</ul>
					</S.Section>

					<S.Section>
						<h2>15. Changes to Terms</h2>
						<p>
							We reserve the right to modify these terms at any time. Changes will be effective immediately upon
							posting. Your continued use of Bazar constitutes acceptance of any modifications.
						</p>
					</S.Section>

					<S.Section>
						<h2>16. Termination</h2>
						<p>
							Bazar reserves the right to suspend, restrict, or terminate your access to the Platform at any time, with
							or without notice, and for any reason. If your account is terminated, you will not be entitled to any
							refunds for amounts already paid.
						</p>
					</S.Section>

					<S.Section>
						<h2>17. Contact Information</h2>
						<p>
							If you have any questions about these Terms of Service, please contact us through our Discord community or
							GitHub repository.
						</p>
					</S.Section>
				</S.Content>
			</S.Container>
		</S.Wrapper>
	);
}
