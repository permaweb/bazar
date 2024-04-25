import React from 'react';
import { ReactSVG } from 'react-svg';
import PropTypes from 'prop-types';

import { Button } from 'components/atoms/Button';
import { TabType } from 'helpers/types';

import * as S from './styles';

class Tab extends React.Component<any, any> {
	static propTypes = {
		activeTab: PropTypes.string.isRequired,
		label: PropTypes.string.isRequired,
		icon: PropTypes.string.isRequired,
		onClick: PropTypes.func.isRequired,
		type: PropTypes.string.isRequired,
	};

	handlePress = () => {
		const { label, onClick } = this.props as any;
		onClick(label);
	};

	render() {
		const {
			handlePress,
			props: { activeTab, label, icon, type },
		} = this;

		function getTab() {
			switch (type) {
				case 'primary':
					return (
						<S.Tab>
							<Button
								type={'primary'}
								label={label}
								active={activeTab === label}
								handlePress={handlePress}
								icon={icon}
								iconLeftAlign
							/>
						</S.Tab>
					);
				case 'alt1':
					return (
						<S.AltTab>
							<S.AltTabAction active={activeTab === label} onClick={handlePress} icon={icon !== null}>
								{icon && (
									<S.Icon active={activeTab === label}>
										<ReactSVG src={icon} />
									</S.Icon>
								)}
								{label}
							</S.AltTabAction>
						</S.AltTab>
					);
			}
		}

		return getTab();
	}
}

export default class Tabs extends React.Component<{ children: any; onTabPropClick: any; type: TabType }, any> {
	constructor(props: any) {
		super(props);
		this.state = {
			activeTab: Array.isArray(this.props.children)
				? this.props.children[0].props.label
				: this.props.children!.props.label,
		};
	}

	onClickTabItem = (tab: any) => {
		this.setState({ activeTab: tab });
		this.props.onTabPropClick(tab);
	};

	render() {
		const singleChild = !Array.isArray(this.props.children);

		const {
			onClickTabItem,
			props: { children },
			state: { activeTab },
		} = this;

		return singleChild ? (
			<S.Container>
				<S.List>
					<Tab
						activeTab={activeTab}
						key={this.props.children!.props.label}
						label={this.props.children!.props.label}
						onClick={onClickTabItem}
						type={this.props.type}
					/>
				</S.List>
				<S.Content>{this.props.children!.props.children}</S.Content>
			</S.Container>
		) : (
			<S.Container>
				<S.List>
					{children!.map((child: any) => {
						const { label, icon } = child.props;
						return (
							<Tab
								activeTab={activeTab}
								key={label}
								icon={icon}
								label={label}
								onClick={onClickTabItem}
								type={this.props.type}
							/>
						);
					})}
				</S.List>
				<S.Content>
					{children!.map((child: any) => {
						if (child.props.label !== activeTab) return undefined;
						return child.props.children;
					})}
				</S.Content>
			</S.Container>
		);
	}
}
