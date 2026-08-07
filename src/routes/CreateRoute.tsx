import React from 'react';
import { ArrowRight, ArrowUpRight, Check, InfinityIcon, Info, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import type { Collection } from 'api/collections';
import {
  AssetMintClient,
  CollectionMintClient,
  CREATED_COLLECTION_ID,
  UDL_LICENSE_ID,
  discardMintDraft,
  getMintDraft,
  isHighMintCost,
  type CollectionMintEstimate,
  type CollectionMintPhase,
  type MintDraft,
  type MintEstimate,
  type MintPhase,
  type MintedAsset,
  type UdlTerms,
} from 'api/asset-mint';
import { waitForAssetState } from 'api/asset-marketplace';
import { AudioArtwork } from 'components/AudioArtwork';
import { Button } from 'components/Button';
import { Loading } from 'components/Loading';
import { isAudioContentType, normalizeAssetContentType } from 'helpers/asset-media';
import { arweaveGatewayFromLocation } from 'helpers/config';
import { useWallet } from 'providers/WalletProvider';

import { formatBytes, MarketContext, MarketSelect, mintErrorMessage, winstonToAr } from '../app/App';

type UdlGrantValue = NonNullable<UdlTerms['derivation'] | UdlTerms['commercialUse'] | UdlTerms['dataModelTraining']>;

function UdlGrantField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: UdlGrantValue;
  options: Array<[string, string]>;
  onChange: (value: UdlGrantValue | undefined) => void;
}) {
  const needsValue = value && ['revenue-share', 'one-time', 'monthly'].includes(value.grant);
  return (
    <div className={needsValue ? 'udl-field udl-grant-field has-value' : 'udl-field udl-grant-field'}>
      <div className={needsValue ? 'udl-field-control with-value' : 'udl-field-control'}>
        <MarketSelect
          label={label}
          value={value?.grant ?? ''}
          options={[
            { value: '', label: 'Not granted' },
            ...options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel })),
          ]}
          onChange={(grant) => {
            if (!grant) return onChange(undefined);
            onChange({
              grant: grant as UdlGrantValue['grant'],
              ...(['one-time', 'monthly'].includes(grant)
                ? { value: '1' }
                : grant === 'revenue-share'
                  ? { value: '10' }
                  : {}),
            });
          }}
        />
        {needsValue ? (
          <label className="udl-value">
            <span>{value.grant === 'revenue-share' ? 'Percent' : 'Amount'}</span>
            <input
              aria-label={`${label} ${value.grant === 'revenue-share' ? 'percentage' : 'fee amount'}`}
              inputMode="decimal"
              min="0.000000000001"
              max={value.grant === 'revenue-share' ? '100' : undefined}
              step="any"
              type="number"
              value={value.value ?? '1'}
              onChange={(event) => onChange({ ...value, value: event.target.value || '1' })}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

export default function CreateRoute() {
  const market = React.useContext(MarketContext);
  const wallet = useWallet();
  const navigate = useNavigate();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const artworkInput = React.useRef<HTMLInputElement>(null);
  const [mode, setMode] = React.useState<'asset' | 'collection'>('asset');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [artwork, setArtwork] = React.useState<File | null>(null);
  const [collectionFiles, setCollectionFiles] = React.useState<File[]>([]);
  const [preview, setPreview] = React.useState('');
  const [artworkPreview, setArtworkPreview] = React.useState('');
  const [collectionPreviews, setCollectionPreviews] = React.useState<string[]>([]);
  const [estimate, setEstimate] = React.useState<MintEstimate | null>(null);
  const [collectionEstimate, setCollectionEstimate] = React.useState<CollectionMintEstimate | null>(null);
  const [estimating, setEstimating] = React.useState(false);
  const [allowHighCost, setAllowHighCost] = React.useState(false);
  const [udlEnabled, setUdlEnabled] = React.useState(true);
  const [udlTerms, setUdlTerms] = React.useState<UdlTerms>({});
  const [phase, setPhase] = React.useState<MintPhase | null>(null);
  const [collectionPhase, setCollectionPhase] = React.useState<CollectionMintPhase | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<MintedAsset | null>(null);
  const [resultReady, setResultReady] = React.useState(false);
  const [collectionResult, setCollectionResult] = React.useState<Collection | null>(null);
  const [draft, setDraft] = React.useState<MintDraft | null>(() =>
    wallet.address ? getMintDraft(wallet.address) : null,
  );
  const activeUdl = udlEnabled ? udlTerms : undefined;
  const selectedContentType = file ? normalizeAssetContentType(file.type, file.name) : null;
  const audioSelected = isAudioContentType(selectedContentType ?? undefined);
  const hasUdlPayment = Boolean(
    activeUdl?.accessFee ||
    ['revenue-share', 'one-time', 'monthly'].includes(activeUdl?.derivation?.grant ?? '') ||
    ['revenue-share', 'one-time', 'monthly'].includes(activeUdl?.commercialUse?.grant ?? '') ||
    ['one-time', 'monthly'].includes(activeUdl?.dataModelTraining?.grant ?? ''),
  );

  React.useEffect(() => {
    setDraft(wallet.address ? getMintDraft(wallet.address) : null);
  }, [wallet.address]);
  React.useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  React.useEffect(() => {
    if (!artwork) {
      setArtworkPreview('');
      return;
    }
    const url = URL.createObjectURL(artwork);
    setArtworkPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [artwork]);
  React.useEffect(() => {
    const urls = collectionFiles.map((item) => URL.createObjectURL(item));
    setCollectionPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [collectionFiles]);
  React.useEffect(() => {
    setResultReady(false);
    if (!result) return;
    const controller = new AbortController();
    void waitForAssetState(result.id, () => true, {
      signal: controller.signal,
      interval: 4000,
      timeout: 0,
    }).then(
      () => {
        if (!controller.signal.aborted) setResultReady(true);
      },
      () => undefined,
    );
    return () => controller.abort();
  }, [result]);
  React.useEffect(() => {
    if (mode !== 'asset' || !file || !name.trim()) {
      setEstimate(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setEstimating(true);
      setError(null);
      void new AssetMintClient()
        .estimate({ file, artwork: artwork ?? undefined, name, description, udl: activeUdl }, controller.signal)
        .then(
          (nextEstimate) => {
            if (!controller.signal.aborted) setEstimate(nextEstimate);
          },
          (cause) => {
            if (!controller.signal.aborted) setError(mintErrorMessage(cause));
          },
        )
        .finally(() => {
          if (!controller.signal.aborted) setEstimating(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeUdl, artwork, description, file, mode, name]);
  React.useEffect(() => {
    if (mode !== 'collection' || !collectionFiles.length || !name.trim()) {
      setCollectionEstimate(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setEstimating(true);
      setError(null);
      void new CollectionMintClient()
        .estimate({ files: collectionFiles, name, description, udl: activeUdl }, controller.signal)
        .then(
          (nextEstimate) => {
            if (!controller.signal.aborted) setCollectionEstimate(nextEstimate);
          },
          (cause) => {
            if (!controller.signal.aborted) setError(mintErrorMessage(cause));
          },
        )
        .finally(() => {
          if (!controller.signal.aborted) setEstimating(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeUdl, collectionFiles, description, mode, name]);

  const selectFile = (next: File | null) => {
    setFile(next);
    if (!next || !isAudioContentType(normalizeAssetContentType(next.type, next.name) ?? undefined)) setArtwork(null);
    setEstimate(null);
    setAllowHighCost(false);
    setError(null);
    setResult(null);
    if (next && !name.trim()) setName(next.name.replace(/\.[^.]+$/, '').slice(0, 80));
  };
  const selectCollectionFiles = (next: File[]) => {
    setCollectionFiles(next.slice(0, 10));
    setCollectionEstimate(null);
    setAllowHighCost(false);
    setError(next.length > 10 ? 'Collections support up to 10 images at a time.' : null);
    setCollectionResult(null);
  };
  const completeMint = (asset: MintedAsset) => {
    market.addCreatedAsset(asset);
    setResult(asset);
    setDraft(null);
    setPhase(null);
  };
  const mint = async () => {
    if (!wallet.address) {
      wallet.openConnectDialog();
      return;
    }
    if (mode === 'asset' && !file) return setError('Choose an image, MP3, or WAV file to continue.');
    if (mode === 'collection' && !collectionFiles.length) return setError('Choose at least one collection image.');
    setError(null);
    setResult(null);
    setCollectionResult(null);
    try {
      if (mode === 'collection') {
        const minted = await new CollectionMintClient().mint(
          { files: collectionFiles, name, description, udl: activeUdl },
          wallet.address,
          { allowHighCost, onPhase: setCollectionPhase },
        );
        market.addCollection(minted.collection);
        setCollectionResult(minted.collection);
        setCollectionPhase(null);
        return;
      }
      if (!file) return;
      const minted = await new AssetMintClient().mint(
        { file, artwork: artwork ?? undefined, name, description, udl: activeUdl },
        wallet.address,
        {
          allowHighCost,
          onPhase: setPhase,
        },
      );
      completeMint(minted.asset);
    } catch (cause) {
      setDraft(getMintDraft(wallet.address));
      setPhase(null);
      setError(mintErrorMessage(cause));
    }
  };
  const resume = async () => {
    if (!wallet.address || !draft) return;
    setError(null);
    try {
      const minted = await new AssetMintClient().resume(draft, wallet.address, { onPhase: setPhase });
      completeMint(minted.asset);
    } catch (cause) {
      setPhase(null);
      setError(mintErrorMessage(cause));
    }
  };
  const working = phase !== null || collectionPhase !== null;
  const phaseLabel = collectionPhase
    ? collectionPhase.kind === 'asset'
      ? `Asset ${collectionPhase.index + 1} of ${collectionPhase.total}: ${
          {
            'signing-media': 'approve media upload',
            'uploading-media': 'uploading media',
            'signing-artwork': 'approve artwork upload',
            'uploading-artwork': 'uploading artwork',
            'signing-process': 'approve asset process',
            'creating-process': 'creating asset',
          }[collectionPhase.phase]
        }…`
      : `${collectionPhase.kind === 'manifest' ? 'Collection manifest' : 'Collection index'}: ${collectionPhase.phase}…`
    : phase
      ? {
          'signing-media': 'Approve the media upload in your wallet…',
          'uploading-media': 'Uploading media to Arweave…',
          'signing-artwork': 'Approve the album artwork in your wallet…',
          'uploading-artwork': 'Uploading album artwork to Arweave…',
          'signing-process': 'Approve the asset process in your wallet…',
          'creating-process': 'Creating your one-of-one asset…',
        }[phase]
      : '';
  const activeEstimate = mode === 'asset' ? estimate : collectionEstimate;

  return (
    <section className="create-page">
      <div className="create-heading">
        <div>
          <p className="eyebrow">Create on Arweave</p>
          <h1>Upload and mint</h1>
        </div>
        <p>
          {mode === 'asset'
            ? 'Your media and its one-of-one marketplace process are signed in your wallet and stored on Arweave.'
            : 'Mint a group of one-of-one assets and submit their shareable collection index to Arweave.'}
        </p>
      </div>

      <div className="create-mode" role="tablist" aria-label="Create type">
        <Button
          className={mode === 'asset' ? 'active' : undefined}
          role="tab"
          aria-selected={mode === 'asset'}
          type="button"
          size="custom"
          onClick={() => {
            setMode('asset');
            setError(null);
            setAllowHighCost(false);
          }}
        >
          Single asset
        </Button>
        <Button
          className={mode === 'collection' ? 'active' : undefined}
          role="tab"
          aria-selected={mode === 'collection'}
          type="button"
          size="custom"
          onClick={() => {
            setMode('collection');
            setError(null);
            setAllowHighCost(false);
          }}
        >
          Collection
        </Button>
      </div>

      {mode === 'asset' && draft ? (
        <div className="mint-recovery" role="status">
          <div>
            <strong>Finish your previous mint</strong>
            <span>
              The media transaction for “{draft.name}” was accepted by the submission gateway. Only the asset process
              remains.
            </span>
          </div>
          <div>
            <Button type="button" onClick={() => void resume()} disabled={working} size="custom">
              Finish mint
            </Button>
            <Button
              type="button"
              onClick={() => {
                discardMintDraft(draft.owner);
                setDraft(null);
              }}
              disabled={working}
              size="custom"
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <div className="create-layout">
        <div className="create-preview-column">
          <Button
            className={`mint-dropzone${mode === 'asset' && preview ? ' has-file' : ''}${mode === 'collection' && collectionPreviews.length ? ' has-file collection-files' : ''}`}
            type="button"
            size="custom"
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (mode === 'collection') selectCollectionFiles(Array.from(event.dataTransfer.files ?? []));
              else selectFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            {mode === 'collection' && collectionPreviews.length ? (
              <span className="collection-preview-grid">
                {collectionPreviews.slice(0, 6).map((url, index) => (
                  <span key={`${collectionFiles[index]?.name}-${index}`}>
                    <img src={url} alt="" />
                    <small>{index + 1}</small>
                  </span>
                ))}
                {collectionPreviews.length > 6 ? <strong>+{collectionPreviews.length - 6}</strong> : null}
              </span>
            ) : mode === 'asset' && preview ? (
              audioSelected ? (
                <AudioArtwork contentType={selectedContentType ?? undefined} name={file?.name ?? name} />
              ) : (
                <img src={preview} alt="Asset preview" />
              )
            ) : (
              <span>
                <Upload aria-hidden="true" />
                <strong>{mode === 'asset' ? 'Choose media' : 'Choose collection images'}</strong>
                <small>
                  {mode === 'asset'
                    ? 'Images up to 10 MB · MP3 or WAV up to 100 MB'
                    : 'PNG, JPG, WebP, or GIF · up to 10 MB each · 10 images maximum'}
                </small>
              </span>
            )}
          </Button>
          <input
            ref={fileInput}
            className="mint-file-input"
            type="file"
            multiple={mode === 'collection'}
            accept={
              mode === 'collection'
                ? 'image/png,image/jpeg,image/webp,image/gif'
                : 'image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/wav,.mp3,.wav'
            }
            onChange={(event) => {
              if (mode === 'collection') selectCollectionFiles(Array.from(event.target.files ?? []));
              else selectFile(event.target.files?.[0] ?? null);
            }}
          />
          {mode === 'asset' && file ? (
            <div className="mint-file-meta">
              <span>{file.name}</span>
              <strong>{formatBytes(file.size)}</strong>
            </div>
          ) : null}
          {mode === 'asset' && audioSelected ? (
            <div className="mint-artwork-field">
              <div>
                <span>
                  <strong>Album artwork</strong>
                  <small>Optional · PNG, JPG, WebP, or GIF · up to 10 MB</small>
                </span>
                {artworkPreview ? <img src={artworkPreview} alt="Album artwork preview" /> : null}
              </div>
              <div>
                <Button type="button" onClick={() => artworkInput.current?.click()} size="custom">
                  <Upload className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
                  {artwork ? 'Replace artwork' : 'Add artwork'}
                </Button>
                {artwork ? (
                  <Button
                    type="button"
                    size="custom"
                    variant="danger"
                    onClick={() => {
                      setArtwork(null);
                      if (artworkInput.current) artworkInput.current.value = '';
                    }}
                  >
                    <X className="ui-icon ui-icon--sm" aria-hidden="true" /> Remove
                  </Button>
                ) : null}
              </div>
              <input
                ref={artworkInput}
                className="mint-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => {
                  setArtwork(event.target.files?.[0] ?? null);
                  setEstimate(null);
                  setAllowHighCost(false);
                  setError(null);
                }}
              />
            </div>
          ) : null}
          {mode === 'collection' && collectionFiles.length ? (
            <div className="collection-file-list">
              {collectionFiles.map((item, index) => (
                <div key={`${item.name}-${item.size}-${index}`}>
                  <span>
                    <strong>{index + 1}</strong>
                    {item.name.replace(/\.[^.]+$/, '')}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => selectCollectionFiles(collectionFiles.filter((_, heldIndex) => heldIndex !== index))}
                    variant="danger"
                  >
                    <X className="ui-icon ui-icon--sm" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button type="button" onClick={() => fileInput.current?.click()} size="custom">
                <Upload className="ui-icon ui-icon--sm" aria-hidden="true" /> Add images
              </Button>
            </div>
          ) : null}
        </div>

        <form
          className="create-form"
          onSubmit={(event) => {
            event.preventDefault();
            void mint();
          }}
        >
          <div className="create-field">
            <label htmlFor="mint-name">{mode === 'asset' ? 'Name' : 'Collection name'}</label>
            <input
              id="mint-name"
              maxLength={80}
              placeholder={mode === 'asset' ? 'Name your asset' : 'Name your collection'}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <span>{name.length} / 80</span>
          </div>
          <div className="create-field">
            <label htmlFor="mint-description">
              {mode === 'asset' ? 'Description' : 'Collection description'} <small>Optional</small>
            </label>
            <textarea
              id="mint-description"
              maxLength={600}
              placeholder={mode === 'asset' ? 'Tell collectors about this work' : 'Describe this collection'}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <span>{description.length} / 600</span>
          </div>

          <section className="create-license" aria-labelledby="mint-license-heading">
            <div className="create-license-heading">
              <div>
                <strong id="mint-license-heading">Usage rights</strong>
                <span>
                  Attach machine-readable terms stored with {mode === 'asset' ? 'this asset' : 'every asset'} on
                  Arweave.
                </span>
              </div>
              <MarketSelect<'udl' | 'none'>
                label="License"
                value={udlEnabled ? 'udl' : 'none'}
                options={[
                  { value: 'udl', label: 'Universal Data License 0.2' },
                  { value: 'none', label: 'No license tags' },
                ]}
                onChange={(value) => {
                  setUdlEnabled(value === 'udl');
                  setEstimate(null);
                  setCollectionEstimate(null);
                  setError(null);
                }}
                showLabel={false}
              />
            </div>

            {udlEnabled ? (
              <div className="udl-options">
                <p>
                  Free access is the default. Rights not granted below remain reserved.{' '}
                  <a href={`${arweaveGatewayFromLocation()}/${UDL_LICENSE_ID}`} target="_blank" rel="noreferrer">
                    Read UDL 0.2 <ArrowUpRight className="ui-icon ui-icon--sm" aria-hidden="true" />
                  </a>
                </p>
                <div className="udl-grid">
                  <div className="udl-field">
                    <div className={udlTerms.accessFee ? 'udl-field-control with-value' : 'udl-field-control'}>
                      <MarketSelect<'free' | 'one-time'>
                        label="Access"
                        value={udlTerms.accessFee ? 'one-time' : 'free'}
                        options={[
                          { value: 'free', label: 'Free' },
                          { value: 'one-time', label: 'One-time fee' },
                        ]}
                        onChange={(value) =>
                          setUdlTerms((current) => ({
                            ...current,
                            accessFee: value === 'one-time' ? '1' : undefined,
                          }))
                        }
                      />
                      {udlTerms.accessFee ? (
                        <label className="udl-value">
                          <span>Amount</span>
                          <input
                            aria-label="Access fee amount"
                            inputMode="decimal"
                            min="0.000000000001"
                            step="any"
                            type="number"
                            value={udlTerms.accessFee}
                            onChange={(event) =>
                              setUdlTerms((current) => ({ ...current, accessFee: event.target.value || '1' }))
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                  </div>
                  <UdlGrantField
                    label="Derivatives"
                    value={udlTerms.derivation}
                    options={[
                      ['allowed', 'Allowed'],
                      ['credit', 'Allowed with credit'],
                      ['indication', 'Allowed with change indication'],
                      ['license-passthrough', 'Allowed with license passthrough'],
                      ['revenue-share', 'Allowed with revenue share'],
                      ['one-time', 'Allowed with one-time fee'],
                      ['monthly', 'Allowed with monthly fee'],
                    ]}
                    onChange={(value) =>
                      setUdlTerms((current) => ({ ...current, derivation: value as UdlTerms['derivation'] }))
                    }
                  />
                  <UdlGrantField
                    label="Commercial use"
                    value={udlTerms.commercialUse}
                    options={[
                      ['allowed', 'Allowed'],
                      ['credit', 'Allowed with credit'],
                      ['revenue-share', 'Allowed with revenue share'],
                      ['one-time', 'Allowed with one-time fee'],
                      ['monthly', 'Allowed with monthly fee'],
                    ]}
                    onChange={(value) =>
                      setUdlTerms((current) => ({ ...current, commercialUse: value as UdlTerms['commercialUse'] }))
                    }
                  />
                  <UdlGrantField
                    label="AI model training"
                    value={udlTerms.dataModelTraining}
                    options={[
                      ['allowed', 'Allowed'],
                      ['one-time', 'Allowed with one-time fee'],
                      ['monthly', 'Allowed with monthly fee'],
                    ]}
                    onChange={(value) =>
                      setUdlTerms((current) => ({
                        ...current,
                        dataModelTraining: value as UdlTerms['dataModelTraining'],
                      }))
                    }
                  />
                </div>

                {hasUdlPayment ? (
                  <div className="udl-payment">
                    <div className="udl-field">
                      <div className="udl-field-control">
                        <MarketSelect<'U' | 'AR'>
                          label="Payment currency"
                          value={udlTerms.currency ?? 'U'}
                          options={[
                            { value: 'U', label: '$U (UDL default)' },
                            { value: 'AR', label: 'AR' },
                          ]}
                          onChange={(value) =>
                            setUdlTerms((current) => ({
                              ...current,
                              currency: value === 'AR' ? 'AR' : undefined,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="udl-field udl-address">
                      <label htmlFor="udl-payment-address">Payment address</label>
                      <div className="udl-field-control">
                        <input
                          id="udl-payment-address"
                          maxLength={43}
                          placeholder={wallet.address || 'Uploader wallet by default'}
                          value={udlTerms.paymentAddress ?? ''}
                          onChange={(event) =>
                            setUdlTerms((current) => ({
                              ...current,
                              paymentAddress: event.target.value.trim() || undefined,
                            }))
                          }
                        />
                      </div>
                    </div>
                    {udlTerms.paymentAddress && udlTerms.paymentAddress !== wallet.address ? (
                      <p className="udl-payment-warning">
                        License payments will go to this address, not the connected wallet.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <details className="udl-advanced">
                  <summary>Advanced terms</summary>
                  <div className="udl-grid">
                    <div className="udl-field">
                      <div className="udl-field-control">
                        <MarketSelect<'included' | 'excluded'>
                          label="Unknown usage rights"
                          value={udlTerms.unknownUsageRights ?? 'included'}
                          options={[
                            { value: 'included', label: 'Included when legally available' },
                            { value: 'excluded', label: 'Excluded' },
                          ]}
                          onChange={(value) =>
                            setUdlTerms((current) => ({
                              ...current,
                              unknownUsageRights: value === 'excluded' ? 'excluded' : undefined,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="udl-field">
                      <label htmlFor="udl-expiry">License term</label>
                      <div className="udl-field-control with-suffix">
                        <input
                          id="udl-expiry"
                          inputMode="numeric"
                          min="1"
                          placeholder="Unlimited"
                          step="1"
                          type="number"
                          value={udlTerms.expiry ?? ''}
                          onChange={(event) =>
                            setUdlTerms((current) => ({ ...current, expiry: event.target.value || undefined }))
                          }
                        />
                        <span>years</span>
                      </div>
                    </div>
                    {hasUdlPayment ? (
                      <div className="udl-field">
                        <div className="udl-field-control">
                          <MarketSelect<'direct' | 'random' | 'global'>
                            label="Payment mode"
                            value={udlTerms.paymentMode ?? 'direct'}
                            options={[
                              { value: 'direct', label: 'Direct to payment address' },
                              { value: 'random', label: 'Random PST distribution' },
                              { value: 'global', label: 'Global PST distribution' },
                            ]}
                            onChange={(value) =>
                              setUdlTerms((current) => ({
                                ...current,
                                paymentMode: value === 'random' || value === 'global' ? value : undefined,
                              }))
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </details>
              </div>
            ) : (
              <p className="udl-none">No license metadata will be written. Copyright defaults still apply.</p>
            )}
          </section>

          <div className="mint-summary">
            <div>
              <span>{mode === 'asset' ? 'Edition' : 'Assets'}</span>
              <strong>{mode === 'asset' ? '1 of 1' : collectionFiles.length || '—'}</strong>
            </div>
            <div>
              <span>{mode === 'asset' ? 'Storage target' : 'Transactions'}</span>
              <strong>
                {mode === 'asset' ? 'Arweave' : collectionEstimate ? collectionEstimate.transactionCount : '—'}
              </strong>
            </div>
            <div>
              <span>Estimated network cost</span>
              <strong>
                {estimating ? 'Checking…' : activeEstimate ? `${winstonToAr(activeEstimate.total.toString())} AR` : '—'}
              </strong>
            </div>
          </div>

          {activeEstimate && isHighMintCost(activeEstimate.total) ? (
            <label className="mint-cost-confirmation">
              <input
                type="checkbox"
                checked={allowHighCost}
                onChange={(event) => setAllowHighCost(event.target.checked)}
              />
              I approve this unusually high network cost.
            </label>
          ) : null}
          <div className="mint-notice">
            <Info className="ui-icon" aria-hidden="true" />
            <span>
              {mode === 'asset'
                ? artwork
                  ? 'Your wallet will request three signatures: one for the media, one for the album artwork, and one for the tradeable asset.'
                  : 'Your wallet will request two signatures: one for the media and one for the tradeable asset.'
                : collectionEstimate
                  ? `Your wallet will request ${collectionEstimate.transactionCount} signatures: two per asset, then the collection manifest and index.`
                  : 'Each image becomes a one-of-one asset. Bazar then submits a collection manifest and index to Arweave.'}
            </span>
          </div>
          {error ? (
            <div className="inline-error">
              <span>{error}</span>
            </div>
          ) : null}
          {result || collectionResult ? (
            <div className={`mint-success${result && !resultReady ? ' propagating' : ''}`}>
              <span>{result && !resultReady ? <InfinityIcon aria-hidden="true" /> : <Check aria-hidden="true" />}</span>
              <div>
                <strong>
                  {collectionResult
                    ? 'Collection transactions accepted by submission gateway'
                    : 'Mint transactions accepted by submission gateway'}
                </strong>
                <p>
                  {collectionResult
                    ? 'Gateway availability can vary while the collection transactions are mined and indexed.'
                    : resultReady
                      ? 'The asset is live and computable through the selected gateway.'
                      : 'Watching while this page remains open. You can view the asset as soon as its live state resolves.'}
                </p>
              </div>
              <Button
                type="button"
                size="custom"
                disabled={Boolean(result && !resultReady)}
                onClick={() =>
                  navigate(
                    collectionResult
                      ? `/collection/${collectionResult.id}`
                      : `/asset/${CREATED_COLLECTION_ID}/${result!.id}`,
                  )
                }
              >
                {result && !resultReady ? (
                  <>
                    Watching Arweave <InfinityIcon className="ui-icon ui-icon--sm" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    View {collectionResult ? 'collection' : 'asset'}{' '}
                    <ArrowRight className="ui-icon ui-icon--sm" aria-hidden="true" />
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              className="mint-submit"
              type="submit"
              size="custom"
              disabled={
                working ||
                Boolean(wallet.address && mode === 'asset' && file && name.trim() && !estimate) ||
                Boolean(
                  wallet.address &&
                  mode === 'collection' &&
                  collectionFiles.length &&
                  name.trim() &&
                  !collectionEstimate,
                ) ||
                Boolean(wallet.address && activeEstimate && isHighMintCost(activeEstimate.total) && !allowHighCost)
              }
            >
              {working
                ? phaseLabel
                : wallet.address
                  ? mode === 'asset'
                    ? 'Upload and mint'
                    : 'Mint collection'
                  : 'Connect wallet to create'}
              {!working ? <ArrowRight className="ui-icon" aria-hidden="true" /> : null}
            </Button>
          )}
          <p className="mint-permanence">
            Confirmed Arweave uploads are permanent and cannot be edited. Review every image, name, and description
            before signing.
          </p>
        </form>
      </div>
    </section>
  );
}
