import React, { useState } from 'react';

import { Button } from 'components/atoms/Button';
import { IconButton } from 'components/atoms/IconButton';
import { AOCONFIG, ASSETS } from 'helpers/config';
import { AOSettings, useAOSettings } from 'providers/AOSettingsProvider';
import { CloseHandler } from 'wrappers/CloseHandler';

import * as S from './styles';

interface SettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
	const { settings, updateSettings, resetToDefaults, isUsingDefaults } = useAOSettings();

	const [formData, setFormData] = useState<AOSettings>(settings);
	const [hasChanges, setHasChanges] = useState(false);

	React.useEffect(() => {
		setFormData(settings);
		setHasChanges(false);
	}, [settings, isOpen]);

	const handleInputChange = (field: keyof AOSettings, value: string) => {
		const newFormData = { ...formData, [field]: value };
		setFormData(newFormData);

		// Check if there are changes from current settings
		const hasChanges = Object.keys(newFormData).some(
			(key) => newFormData[key as keyof AOSettings] !== settings[key as keyof AOSettings]
		);
		setHasChanges(hasChanges);
	};

	const handleSave = () => {
		updateSettings(formData);
		onClose();
	};

	const handleReset = () => {
		resetToDefaults();
		onClose();
	};

	const handleCancel = () => {
		setFormData(settings);
		setHasChanges(false);
		onClose();
	};

	if (!isOpen) return null;

	return (
		<div className={'overlay'}>
			<S.Wrapper className={'border-wrapper-primary'}>
				<CloseHandler active={isOpen} disabled={!isOpen} callback={handleCancel}>
					<S.Content>
						<S.Header>
							<h3>AO Network Settings</h3>
							<IconButton
								type={'primary'}
								src={ASSETS.close}
								handlePress={handleCancel}
								dimensions={{
									wrapper: 35,
									icon: 20,
								}}
								tooltip={'Close'}
								useBottomToolTip
							/>
						</S.Header>

						<S.Form>
							<S.FormGroup>
								<S.Label>Compute Unit (CU) URL</S.Label>
								<S.Input
									type="text"
									value={formData.cu_url}
									onChange={(e) => handleInputChange('cu_url', e.target.value)}
									placeholder={AOCONFIG.cu_url}
								/>
							</S.FormGroup>

							<S.FormGroup>
								<S.Label>Message Unit (MU) URL</S.Label>
								<span>Coming Soon</span>
							</S.FormGroup>

							<S.FormGroup>
								<S.Label>Arweave Gateway</S.Label>
								<span>Coming Soon</span>
							</S.FormGroup>

							<S.FormGroup>
								<S.Label>Hyperbeam Node URL</S.Label>
								<span>Coming Soon</span>
							</S.FormGroup>

							<S.StatusWrapper>
								{isUsingDefaults && !hasChanges ? (
									<S.StatusText>Using default settings</S.StatusText>
								) : (
									<S.StatusText>Using custom settings</S.StatusText>
								)}
							</S.StatusWrapper>
						</S.Form>

						<S.Actions>
							<Button
								type={'alt1'}
								label={'Reset to Defaults'}
								handlePress={handleReset}
								disabled={isUsingDefaults && !hasChanges}
							/>
							<S.ActionGroup>
								<Button type={'alt2'} label={'Cancel'} handlePress={handleCancel} />
								<Button type={'primary'} label={'Save'} handlePress={handleSave} disabled={!hasChanges} />
							</S.ActionGroup>
						</S.Actions>
					</S.Content>
				</CloseHandler>
			</S.Wrapper>
		</div>
	);
}
