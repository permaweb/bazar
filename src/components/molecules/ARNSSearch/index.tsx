import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ARIO } from '@ar.io/sdk';
import { Search as SearchIcon } from '@mui/icons-material';
import {
	Box,
	Chip,
	CircularProgress,
	InputAdornment,
	List,
	ListItem,
	ListItemText,
	Paper,
	TextField,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { debounce } from 'lodash';

import { fetchANTInfo } from '../../../helpers/arnsFetch';
import { ARNSRecord, ARNSSearchProps } from '../../../types/ant';

const SearchContainer = styled(Box)(({ theme }) => ({
	width: '100%',
	maxWidth: 800,
	margin: '0 auto',
	padding: theme.spacing(2),
	position: 'relative',
}));

const ResultsDropdown = styled(Paper)(({ theme }) => ({
	position: 'absolute',
	top: '100%',
	left: 0,
	right: 0,
	zIndex: 1000,
	maxHeight: '400px',
	overflowY: 'auto',
	marginTop: theme.spacing(1),
}));

const ResultItem = styled(ListItem)(({ theme }) => ({
	cursor: 'pointer',
	'&:hover': {
		backgroundColor: theme.palette.action.hover,
	},
}));

const TypeChip = styled(Chip)(({ theme }) => ({
	marginLeft: theme.spacing(1),
	backgroundColor: theme.palette.primary.main,
	color: theme.palette.primary.contrastText,
}));

export const ARNSSearch: React.FC<ARNSSearchProps> = ({ onResultsFound, onLoading, onError }) => {
	const [searchTerm, setSearchTerm] = useState('');
	const [isSearching, setIsSearching] = useState(false);
	const [dropdownResults, setDropdownResults] = useState<ARNSRecord[]>([]);
	const [showDropdown, setShowDropdown] = useState(false);
	const navigate = useNavigate();

	// Fetch and display marketplace data
	useEffect(() => {
		const fetchMarketplaceData = async () => {
			try {
				setIsSearching(true);
				onLoading(true);

				const ario = ARIO.mainnet();
				const { items: records } = await ario.getArNSRecords({
					limit: 100,
					sortBy: 'startTimestamp',
					sortOrder: 'desc',
				});

				const processedRecords = await Promise.all(
					records.map(async (record) => {
						try {
							const antInfo = await fetchANTInfo(record.processId, record.name);
							return {
								name: record.name,
								processId: record.processId,
								startTimestamp: record.startTimestamp,
								endTimestamp: record.type === 'lease' ? record.endTimestamp : 0,
								type: record.type || 'permabuy',
								antInfo,
							} as ARNSRecord;
						} catch (error) {
							console.warn(`Failed to fetch ANT info for ${record.processId}:`, error);
							return null;
						}
					})
				);

				const validRecords = processedRecords.filter(Boolean) as ARNSRecord[];
				onResultsFound(validRecords);
			} catch (err: any) {
				console.error('Error fetching marketplace data:', err);
				onError(err.message || 'Failed to fetch marketplace data');
			} finally {
				setIsSearching(false);
				onLoading(false);
			}
		};

		fetchMarketplaceData();
	}, [onLoading, onError, onResultsFound]);

	const searchArns = useCallback(
		debounce(async (term: string) => {
			if (!term) {
				setDropdownResults([]);
				setShowDropdown(false);
				return;
			}

			try {
				setIsSearching(true);
				onLoading(true);
				onError(null);

				const ario = ARIO.mainnet();
				const { items: records } = await ario.getArNSRecords({
					searchTerm: term,
					limit: 20,
					sortBy: 'startTimestamp',
					sortOrder: 'desc',
				});

				const processedRecords = await Promise.all(
					records.map(async (record) => {
						try {
							const antInfo = await fetchANTInfo(record.processId, record.name);
							return {
								name: record.name,
								processId: record.processId,
								startTimestamp: record.startTimestamp,
								endTimestamp: record.type === 'lease' ? record.endTimestamp : 0,
								type: record.type || 'permabuy',
								antInfo,
							} as ARNSRecord;
						} catch (error) {
							console.warn(`Failed to fetch ANT info for ${record.processId}:`, error);
							return null;
						}
					})
				);

				const validRecords = processedRecords.filter(Boolean) as ARNSRecord[];
				setDropdownResults(validRecords);
				setShowDropdown(true);
				onResultsFound(validRecords);
			} catch (err: any) {
				console.error('Error searching ARNS:', err);
				onError(err.message || 'Failed to search ARNS');
				onResultsFound([]);
			} finally {
				setIsSearching(false);
				onLoading(false);
			}
		}, 300),
		[onResultsFound, onLoading, onError]
	);

	const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value;
		setSearchTerm(value);
		searchArns(value);
	};

	const handleResultClick = (record: ARNSRecord) => {
		navigate(`/asset/${record.processId}`);
		setShowDropdown(false);
	};

	return (
		<SearchContainer className="search-container">
			<TextField
				fullWidth
				variant="outlined"
				placeholder="Search for ARNS names..."
				value={searchTerm}
				onChange={handleSearchChange}
				InputProps={{
					startAdornment: (
						<InputAdornment position="start">
							<SearchIcon />
						</InputAdornment>
					),
					endAdornment: isSearching && (
						<InputAdornment position="end">
							<CircularProgress size={20} />
						</InputAdornment>
					),
				}}
			/>
			{showDropdown && dropdownResults.length > 0 && (
				<ResultsDropdown>
					<List>
						{dropdownResults.map((record) => (
							<ResultItem key={record.processId} onClick={() => handleResultClick(record)}>
								<ListItemText
									primary={record.name}
									secondary={`Registered: ${new Date(record.startTimestamp * 1000).toLocaleDateString()}`}
								/>
								<TypeChip label={record.type} size="small" />
							</ResultItem>
						))}
					</List>
				</ResultsDropdown>
			)}
		</SearchContainer>
	);
};
