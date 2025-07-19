# Orby Integration Rollout Strategy

## Feature Overview

This rollout strategy covers the integration of Orby for 1-click transactions and gas abstraction in the Zerion Wallet Extension, as documented in [PR #13](https://github.com/orb-labs/zerion-wallet-extension/pull/13) using **Orby by Orb Labs** that provides gas abstraction and transaction batching capabilities for any account type.

## Success Metrics & Rollout Pause Triggers

### Primary Metrics

- **Support Tickets**: No more than 5% increase in tickets related to gas, UX, or funds
- **Transaction Latency**: No more than 50% increase in transaction submission latency
- **Error Rates**: No more than 5% increase in transaction errors

### Rollout Pause Triggers

Pause progression to next phase if any of the following occur:

- Support ticket increase > 5%
- Transaction latency increase > 50%
- Error rate increase > 5%
- Critical user complaints or funds-related issues

## Rollout Schedule

### Phase 1: Daily Expansion (Days 1-7)

- **Day 1**: 1,000 users
- **Day 2**: 2,500 users
- **Day 3**: 5,000 users
- **Day 4**: 7,500 users
- **Day 5**: 10,000 users
- **Day 6**: 15,000 users
- **Day 7**: 25,000 users

### Phase 2: Weekly Expansion (Weeks 2-8)

- **Week 2**: 5% of total user base
- **Week 3**: 15% of total user base
- **Week 4**: 30% of total user base
- **Week 5**: 60% of total user base
- **Week 6**: 80% of total user base
- **Week 7**: 100% of total user base

### Total Timeline: ~2 months

## Feature Flag Configuration

### User-Based Gating (Not Chain-Based)

```typescript
// Remote config key: one_click_transactions_and_gas_abstraction
// Gating strategy: User-based percentage rollout
// Default: false (disabled by default)
```

### Implementation

- Use existing `one_click_transactions_and_gas_abstraction` feature flag
- Configure user percentage in remote config system
- No chain-specific gating - feature enabled per user across all supported chains

### User Selection Methodology

#### Selection Criteria

- **Random Selection**: Users selected randomly from the eligible user base
- **Eligibility**: All active users (defined as users who have used the wallet in the last 30 days)

#### Selection Process

1. **Percentage Application**: Apply target percentage to eligible users
2. **Random Sampling**: Use deterministic but random selection to ensure consistency
3. **Persistence**: Once selected, users remain in the rollout group unless manually removed

#### Technical Implementation

- **Feature Flag Vendor**: Firebase or LaunchDarkly (or similar) handles user-based rollouts
- **User Context**: User address is passed as the user identifier to the feature flag service
- **Percentage Rollout**: Configured directly in the feature flag dashboard
- **Deterministic Selection**: Vendor ensures consistent user selection across sessions

#### User Experience

- **Transparent**: Users are not explicitly notified of their selection
- **Seamless**: Feature appears automatically when enabled
- **Consistent**: Selected users see the feature across all sessions

## Monitoring Plan

### Daily Monitoring

- Support ticket volume and categorization
- Transaction success/failure rates
- Average transaction submission time
- User feedback and complaints

### Weekly Reviews

- Compare metrics against baseline
- Assess user adoption and engagement
- Review support ticket trends
- Evaluate rollout pace

### Key Dashboards

- Transaction performance metrics
- Support ticket analytics
- User engagement metrics
- Error rate tracking

## Testing Strategy

### Pre-Rollout Testing

- [ ] Internal team testing with feature flag enabled
- [ ] QA testing across all supported chains
- [ ] Performance baseline establishment
- [ ] Support team awareness (and maybe training) on new features

### Ongoing Testing

- [ ] Monitor transaction flows in production
- [ ] Track user behavior changes
- [ ] Validate gas abstraction functionality
- [ ] Test 1-click transaction flows

## Communication Plan

### Internal Communication

- **Daily**: Metrics review and alert monitoring, Stakeholder updates
- **Weekly**: Rollout progress updates, Stakeholder updates

### User Communication

- In-app notifications for users receiving the feature
- Support documentation updates
- Community announcements for major milestones

## Rollout Pause Procedures

### Immediate Pause (0-1 hour)

1. Freeze user percentage at current level
2. Notify team via Slack
3. Monitor metrics for stabilization
4. Assess root cause

### Post-Pause (24-48 hours)

1. Investigate root cause
2. Implement fixes if needed
3. Plan resumption strategy
4. Update documentation

## Success Criteria

### Technical Success

- Transaction success rates maintained or improved
- No significant performance degradation
- Error rates within acceptable limits
- Gas abstraction working correctly

### User Success

- Positive user feedback
- No increase in support tickets
- Improved transaction experience
- Successful 1-click transactions

### Business Success

- Reduced transaction friction
- Maintained or improved user engagement
- No negative impact on transaction volume
- Positive user sentiment

## Risk Mitigation

### Technical Risks

- **Transaction Failures**: Comprehensive testing and monitoring
- **Performance Issues**: Baseline establishment and continuous monitoring
- **Gas Calculation Errors**: Extensive validation and testing

### User Experience Risks

- **Confusion**: Clear UI/UX design and user education
- **Errors**: Extensive testing and validation
- **Support Overload**: Proactive monitoring and quick response

### Rollout Risks

- **Metric Thresholds**: Clear pause triggers to prevent issues from escalating
- **Progressive Exposure**: Gradual user increase to catch issues early
- **Monitoring**: Continuous oversight to detect problems quickly

## Timeline Summary

| Phase | Timeline | User Count | Key Activities |
| --- | --- | --- | --- |
| Daily | Days 1-7 | 1K → 25K | Initial rollout, daily monitoring, validation |
| Weekly | Weeks 2-7 | 5 → 100% | Gradual expansion, weekly metric review |

## Contact & Escalation

- **Primary Contact**:
- **Escalation Path**:
- **Emergency Contact**: On-call engineer
- **Support Team**: Trained on new features and pause procedures

## Engineering Implementation Plan

### Week 1: Foundation & Setup

#### Day 1: Feature Flag Setup

**Ticket**: `ORBY-001: Setup feature flags for progressive rollout`

- [ ] Create remotely configurable feature flag `one_click_transactions_and_gas_abstraction`
- [ ] Configure Firebase/LaunchDarkly for user-based percentage rollouts
- [ ] Set up test/development groups for internal testing
- [ ] **PR**: [Step 0 - Setup feature flags](https://github.com/orb-labs/zerion-wallet-extension/pull/4)
- **Dependencies**: None

#### Day 1: Environment + Testing Setup & OrbyProvider Integration

**Ticket**: `ORBY-002: Setup testing environment and accounts`

- [ ] Obtain EVM and SVM testing accounts with funds
- [ ] Set up accounts with USDC on target chains (BNB Chain, ETH Mainnet, Arbitrum, Base, Optimism)
- [ ] Clear all approvals using revoke.cash
- [ ] Add test accounts to feature flag test group
- **Dependencies**: ORBY-001

#### Day 1: API Integration Setup

**Ticket**: `ORBY-003: Configure Orby API integration`

- [ ] Obtain Orby API keys for instance with 1-click transactions and gas abstraction features
- [ ] Add environment variables:
  ```bash
  ORBY_PRIVATE_API_KEY=
  ORBY_PUBLIC_API_KEY=
  ORBY_BASE_URL=
  ```
- [ ] **PR**: [Step 2 - Configure Orby API integration](https://github.com/orb-labs/zerion-wallet-extension/pull/5)
- **Dependencies**: ORBY-002

**Ticket**: `ORBY-004: Add OrbyProvider to app root`

- [ ] Install `@orb-labs/orby-react` npm package
- [ ] Refactor components to accommodate OrbyProvider at root level
- [ ] Initialize OrbyProvider with current wallet address
- [ ] **PR**: [Step 3 - Add OrbyProvider to app root](https://github.com/orb-labs/zerion-wallet-extension/pull/6)
- **Dependencies**: ORBY-003

#### Day 1: DApp Communication Setup

**Ticket**: `ORBY-005: Configure Orby for dApp communication`

- [ ] Verify extension permissions (`activeTab`, `scripting`, `unlimitedStorage`)
- [ ] Add Orby scripts to manifest:
  - `webpage.js` and `core-webpage.js` to `web_accessible_resources`
  - `core-webpage-injector.js` to `content_scripts`
- [ ] Add build script to copy Orby files to `./src/content-script/`
- [ ] Implement `unifyBalancesOnApps` function in background script
- [ ] **PR**: [Step 4 - Configure Orby for dApp communication](https://github.com/orb-labs/zerion-wallet-extension/pull/7)
- **Dependencies**: ORBY-004

#### Day 2: Send Transaction Integration

**Ticket**: `ORBY-006: Integrate Orby with send transactions`

- [ ] Implement `useIsOrbyEnabled` hook for chain and feature flag checking
- [ ] Add `useGetOperationsToExecuteTransaction` hook integration
- [ ] Display operations to user under details tab
- [ ] Implement gas token selection from user balances
- [ ] **PR**: [Step 5 - Integrate Orby with send transactions](https://github.com/orb-labs/zerion-wallet-extension/pull/8)
- **Dependencies**: ORBY-004

#### Day 2: Typed Data Integration

**Ticket**: `ORBY-007: Integrate Orby with typed data signing`

- [ ] Extend `useIsOrbyEnabled` hook for typed data scenarios
- [ ] Implement `useGetOperationsToSignTransactionOrSignTypedData` hook
- [ ] Add gas token selection for typed data transactions
- [ ] **PR**: [Step 6 - Integrate Orby with typed data signing](https://github.com/orb-labs/zerion-wallet-extension/pull/9)
- **Dependencies**: ORBY-004

#### Day 3: Operation Signing

**Ticket**: `ORBY-008: Implement operation signing and submission`

- [ ] Create `signOperation`, `signTransaction`, and `signUserOperation` functions in `src/shared/core/orb.ts`
- [ ] Integrate with existing wallet signing functions in `src/background/Wallet/Wallet.ts`
- [ ] Implement `sendOperationSet` function call to Orby virtual nodes
- [ ] Add `subscribeToOperationStatuses` for operation monitoring
- [ ] **PR**: [Step 8 - Implement operation signing and submission](https://github.com/orb-labs/zerion-wallet-extension/pull/10)
- **Dependencies**: ORBY-004

#### Day 4: Solana Integration

**Ticket**: `ORBY-009: Add Solana support`

- [ ] Auto-detect VM from address before passing to OrbyProvider
- [ ] Implement SVM transaction handling with `useGetOperationsToSignTransactionOrSignTypedData`
- [ ] Add SVM operation signing support to `signOperation` functions
- [ ] Implement gas token selection for Solana
- [ ] Handle `signAllTransactions` and `signTransaction` return values
- [ ] **PR**: [Step 10 - Add Solana support](https://github.com/orb-labs/zerion-wallet-extension/pull/11)
- **Dependencies**: ORBY-008

#### Day 5: In-Wallet Integration

**Ticket**: `ORBY-011: Support in-wallet swap, bridge, and send`

- [ ] Integrate Orby with existing swap functionality
- [ ] Integrate Orby with existing bridge functionality
- [ ] Integrate Orby with existing send functionality
- [ ] Maintain existing 3rd-party service integrations
- [ ] Add gas token selection for in-wallet actions
- [ ] **PR**: [Step 11 - Support in-wallet swap, bridge, and send](https://github.com/orb-labs/zerion-wallet-extension/pull/13)
- **Dependencies**: ORBY-009

### Week 2: Activity UI Changes

#### Day 6: Activity Display

**Ticket**: `ORBY-010: Implement batched activity display`

- [ ] Fetch and display batched user activity when Orby is enabled
- [ ] Show approve+swap as single row in activity feed
- [ ] **PR**: [Step 9 - Implement batched activity display](https://github.com/orb-labs/zerion-wallet-extension/pull/12)
- **Dependencies**: ORBY-004

#### Day 7: Security & Verification

**Ticket**: `ORBY-013: Security validation and operation verification`

- [ ] Implement operation verification using Blockaid or similar
- [ ] Security review of all Orby integrations
- [ ] Audit gas calculation accuracy
- [ ] Validate transaction safety measures
- [ ] **PR**: [Step 7 - Security validation and operation verification](https://github.com/orb-labs/zerion-wallet-extension/pull/14)
- **Dependencies**: ORBY-004

#### Day 8 - 10: Comprehensive Testing

**Ticket**: `ORBY-012: End-to-end testing and validation`

- [ ] Test gas abstraction on Uniswap (insufficient funds scenarios)
- [ ] Test 1-click transactions (approve+swap scenarios)
- [ ] Test Solana transactions and gas token selection
- [ ] Test in-wallet swap, bridge, and send functionality
- [ ] Cross-browser compatibility testing
- [ ] Performance impact assessment
- **Dependencies**: ORBY-013

### Week 3: Documentation, Bug Bash & Deployment Prep

#### Day 11: Documentation

**Ticket**: `ORBY-014: Complete documentation and deployment preparation`

- [ ] Update technical documentation
- [ ] Create user-facing documentation for new features
- [ ] Prepare release notes
- [ ] Update support team documentation
- **Dependencies**: ORBY-013

#### Day 12: Bug Bash

**Ticket**: `ORBY-015: Conduct comprehensive bug bash`

- [ ] **Setup Bug Bash Environment**
  - [ ] Deploy feature to internal testing environment
  - [ ] Prepare test scenarios and user flows
  - [ ] Set up bug reporting system (GitHub issues, internal tools)
  - [ ] Create test accounts with various token balances
- [ ] **Bug Bash Execution**
  - [ ] **Gas Abstraction Testing**
    - [ ] Test insufficient funds scenarios on multiple chains
    - [ ] Verify gas token selection works correctly
    - [ ] Test edge cases with very low balances
  - [ ] **1-Click Transaction Testing**
    - [ ] Test approve+swap flows on Uniswap, SushiSwap
    - [ ] Verify no approval transactions are sent
    - [ ] Test with various token pairs and amounts
  - [ ] **Solana Integration Testing**
    - [ ] Test Solana transactions with different gas tokens
    - [ ] Verify SVM transaction handling
    - [ ] Test cross-chain scenarios
  - [ ] **In-Wallet Feature Testing**
    - [ ] Test swap functionality with Orby integration
    - [ ] Test bridge functionality with Orby integration
    - [ ] Test send functionality with Orby integration
  - [ ] **Edge Cases & Error Handling**
    - [ ] Test network failures and recovery
    - [ ] Test transaction failures and user feedback
    - [ ] Test concurrent transaction handling
    - [ ] Test browser refresh/reload scenarios
- [ ] **Bug Triage & Prioritization**
  - [ ] Collect and categorize all reported bugs
  - [ ] Prioritize bugs by severity (Critical, High, Medium, Low)
  - [ ] Assign bugs to development team
  - [ ] Create fix timeline for critical issues
- **Dependencies**: ORBY-014

#### Day 13 - 14: Bug Fixes & Final Validation

**Ticket**: `ORBY-016: Fix critical bugs and final validation`

- [ ] **Critical Bug Fixes**
  - [ ] Fix any critical bugs found during bug bash
  - [ ] Re-test fixed functionality
  - [ ] Update test cases based on findings
- [ ] **Final Validation**
  - [ ] Re-run comprehensive test suite
  - [ ] Performance testing with bug bash learnings
  - [ ] Security validation of fixes
  - [ ] Final QA sign-off
- **Dependencies**: ORBY-015

#### Day 15: Final Validation + Launch Go / No-Go

**Ticket**: `ORBY-015: Final validation and rollout preparation`

- [ ] Final QA testing with feature flags enabled
- [ ] Performance baseline establishment
- [ ] Support team training
- [ ] Rollout strategy validation
- **Dependencies**: ORBY-014

## Implementation Summary

### Total Timeline: 3 weeks (15 business days)

### Key Milestones:

- **Week 1**: Foundation setup complete (Days 1-5)
- **Week 2**: Activity UI Changes (Days 6-7)
- **Week 3**: Documentation, Bug Bash & Deployment Prep (Days 11-15)

### Risk Mitigation:

- **Parallel Development**: Some tickets can be worked on in parallel
- **Early Testing**: Continuous testing throughout development
- **Feature Flags**: All features gated for safe rollout
- **Rollback Plan**: Each PR can be reverted independently

---

_This rollout strategy is specifically designed for the Orby integration feature and should be updated based on learnings and feedback throughout the rollout process._
