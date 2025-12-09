import { createGlobalStyle } from 'styled-components';

export const Campaign3Responsive = createGlobalStyle`
  .campaign3-main-wrapper {
    padding: 0 24px;
  }

  .campaign3-cards-row {
    gap: 24px;
    padding: 24px 0;
  }

  @media (max-width: 900px) {
    .campaign3-cards-row {
      flex-direction: column !important;
      align-items: center !important;
      gap: 32px;
    }
  }

  @media (max-width: 1536px) {
    .campaign3-cards-row {
      flex-direction: column;
      align-items: center;
    }
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;
