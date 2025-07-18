import styled from 'styled-components';

const StyledWrapper = styled.div`
  /* Primary container - establishes flex context */
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;

  /* Flex shrink container - allows content to be constrained */
  .height-constraint {
    display: flex;
    flex: 1 1 0;
    min-height: 0;
  }

  /* flex container - enforces boundaries */
  .flex-boundary {
    width: 100%;
    display: flex;
    overflow-y: auto;
  }
`;

export default StyledWrapper;
