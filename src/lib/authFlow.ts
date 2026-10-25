export type AuthFlowState = 'signed-out' | 'signing-in' | 'loading-profile' | 'ready' | 'error' | 'signing-out';

export const useAuthFlow = () => {
  return {
    state: 'ready' as AuthFlowState,
    setState: (_state: AuthFlowState) => {},
  };
};

export default useAuthFlow;
