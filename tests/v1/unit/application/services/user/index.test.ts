import * as modUserDB from '../../../../../../src/v1/infrastructure/persistance/user'
import * as modWalletDB from '../../../../../../src/v1/infrastructure/persistance/wallet'
import * as modUser from '../../../../../../src/v1/application/services/user/index'
import * as modConnection from '../../../../../../src/v1/infrastructure/persistance/connection/connectionFile'
import { moneyTypes, moneyTypesO } from '../../../../../../src/v1/domain'
import { createSandbox, SinonSandbox } from 'sinon'
import { describe, it } from 'mocha'
import chai from 'chai'
import { addCurrency, deleteUserById, saveNewUser, transferMoney, transferMoneyParamsValidator, transferMoneyWithRetry } from '../../../../../../src/v1/application/services/user/index'
import { moneyTransferParamsValidatorErrors, transferMoneyErrors, userFunctionsErrors, transferMoneyWithRetryErrors } from '../../../../../../src/v1/application/services/user/error.dto'
import { transactionQueryRunnerType } from '../../../../../../src/v1/infrastructure/persistance/connection/connectionFile'
import logger from '../../../../../../src/v1/helpers/logger'
import { errorType } from '../../../../../../src/v1/domain/error'
import { userWalletDTO } from '../../../../../../src/v1/application/services/user/dto'

describe('Unit tests user', () => {
  const sandbox: SinonSandbox = createSandbox()

  describe('src > v1 > application > services > user > index > saveNewUser', () => {
    beforeEach(() => {
      sandbox.restore()
    })
    it('should create a new user', async () => {
      const fakeUser = {
        userId: 'fake_22ef5564-0234-11ed-b939-0242ac120002',
        firstname: 'fake_Eugene',
        lastname: 'fake_Porter',
        wallet: {
          walletId: 'fake_515f73c2-027d-11ed-b939-0242ac120002',
          hardCurrency: 2000,
          softCurrency: 2000
        }
      }

      const mockSaveNewUserDB = sandbox.stub(modUserDB, 'saveNewUserDB').returns(Promise.resolve(fakeUser))

      try {
        const response = await saveNewUser(fakeUser.userId, fakeUser.firstname, fakeUser.lastname)

        chai.assert.exists(response, 'Should get the correct response')
        chai.assert.strictEqual(response.userId, fakeUser.userId, 'Should get the correct userId')
        chai.assert.isTrue(mockSaveNewUserDB.calledOnce)
      } catch (err) {
        chai.assert.fail(`Should not happen - no error in catch expected - ${err}`)
      }
    })
    it('should fail creating a new user', async () => {
      const fakeUser = {
        userId: 'fake_22ef5564-0234-11ed-b939-0242ac120002',
        firstname: 'fake_Eugene',
        lastname: 'fake_Porter',
        wallet: {
          walletId: 'fake_515f73c2-027d-11ed-b939-0242ac120002',
          hardCurrency: 2000,
          softCurrency: 2000
        }
      }

      const mockSaveNewUserDB = sandbox.stub(modUserDB, 'saveNewUserDB').rejects(null)
      const mockErrorLogger = sandbox.stub(logger, 'error')

      try {
        await saveNewUser(fakeUser.userId, fakeUser.firstname, fakeUser.lastname)
        chai.assert.fail('Unexpected success')
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        } else {
          const errInfo = JSON.parse(err?.message)
          chai.assert.equal(errInfo.message, userFunctionsErrors.ErrorCreatingUser!.message)
          sandbox.assert.calledOnce(mockSaveNewUserDB)
          sandbox.assert.calledOnce(mockErrorLogger)
        }
      }
    })
  })

  describe('src > v1 > application > services > user > index > addCurrency', () => {
    beforeEach(() => {
      sandbox.restore()
    })
    it('should succeed adding currency', async () => {
      const mockGetUserWalletInfo = sandbox.stub(modUserDB, 'getUserWalletInfoDB').resolves({ Wallet: { walletId: '12345' } } as unknown as userWalletDTO)
      const mockUpdateWalletByWalletIdDB = sandbox.stub(modWalletDB, 'updateWalletByWalletIdDB').resolves(true)

      const amountToAdd = 150
      try {
        const res = await addCurrency('22ef5564-0234-11ed-b939-0242ac120002', moneyTypesO.soft_currency, amountToAdd)
        chai.assert.isTrue(res)
        sandbox.assert.calledOnce(mockGetUserWalletInfo)
        sandbox.assert.calledOnce(mockUpdateWalletByWalletIdDB)
      } catch (err) {
        chai.assert.fail(`Should not get an error - ${String(err)}`)
      }
    })
    it('should fail (negative amount)', async () => {
      const amountToAdd = -55

      try {
        await addCurrency('22ef5564-0234-11ed-b939-0242ac120002', moneyTypesO.soft_currency, amountToAdd)
        chai.assert.fail('Unexpected success')
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errInfo = JSON.parse(err.message)
        chai.assert.equal(errInfo.message, moneyTransferParamsValidatorErrors.ErrorInvalidAmount!.message)
      }
    })
    it('should fail (wrong currency type)', async () => {
      const amountToAdd = 150
      try {
        await addCurrency('22ef5564-0234-11ed-b939-0242ac120002', 'fake_currency_type' as moneyTypes, amountToAdd)
        chai.assert.fail('Unexpected success - Should never happen')
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errInfo = JSON.parse(err?.message)
        chai.assert.equal(errInfo.message, moneyTransferParamsValidatorErrors.ErrorCurrencyType!.message)
      }
    })
  })

  describe('src > v1 > application > services > user > index > deleteUserById', () => {
    beforeEach(() => {
      sandbox.restore()
    })
    it('should delete a single user from DB by its id', async () => {
      const userToFetch: string = '22ef5564-0234-11ed-b939-0242ac120002'

      const mockDeleteUserByIdDB = sandbox.stub(modUserDB, 'deleteUserByIdDB').returns(Promise.resolve(true))
      // const mockDeleteWalletByIdDB = sandbox.stub(modWalletDB, "").returns(Promise.resolve(true))

      try {
        const response = await deleteUserById(userToFetch)
        chai.assert.exists(response, 'Should get a valid response from DB')
        chai.assert.isTrue(response, 'Should get true response from DB')
        chai.assert.isTrue(mockDeleteUserByIdDB.calledOnce)
      } catch (err) {
        chai.assert.fail(`Fail - Unable to delete the user - ${err}`)
      }
    })
  })

  describe('src > v1 > application > services > user > index > transferMoneyParamsValidator', () => {
    beforeEach(() => {
      sandbox.restore()
    })
    it('Should return the 2 users info objects correctly', async () => {
      const validCurrency = moneyTypesO.soft_currency
      const fakeUserGiver = {
        userId: 'fake_22ef5564-0234-11ed-b939-0242ac120002',
        firstname: 'fake_Eugene',
        lastname: 'fake_Porter',
        Wallet: {
          walletId: 'fake_515f73c2-027d-11ed-b939-0242ac120002',
          hardCurrency: 2000,
          softCurrency: 2000 // Sufficient funds
        }
      }

      const fakeUserRecipient = {
        userId: 'fake_22ef5564-0234-11ed-b939-0242ac120002',
        firstname: 'fake_Eugene',
        lastname: 'fake_Porter',
        Wallet: {
          walletId: 'fake_515f73c2-027d-11ed-b939-0242ac120002',
          hardCurrency: 2000,
          softCurrency: 2000
        }
      }

      const mockFetchUserDB = sandbox.stub(modUserDB, 'getUserWalletInfoDB')
      mockFetchUserDB.onFirstCall().resolves(fakeUserGiver)
      mockFetchUserDB.onSecondCall().resolves(fakeUserRecipient)

      const amount = 100

      const [giverUserInfo, recipientUserInfo] = await transferMoneyParamsValidator(validCurrency, fakeUserGiver.userId, fakeUserRecipient.userId, amount)

      chai.assert.isObject(giverUserInfo)
      chai.assert.isObject(recipientUserInfo)
    })
    it('Should throw an error for invalid currency type', async () => {
      const fakeUserGiver = {
        userId: 'fake_22ef5564-0234-11ed-b939-0242ac120002',
        firstname: 'fake_Eugene',
        lastname: 'fake_Porter',
        Wallet: {
          walletId: 'fake_515f73c2-027d-11ed-b939-0242ac120002',
          hardCurrency: 2000,
          softCurrency: 2000
        }
      }

      const fakeUserRecipient = {
        userId: 'fake_22ef5564-0234-11ed-b939-0242ac120002',
        firstname: 'fake_Eugene',
        lastname: 'fake_Porter',
        Wallet: {
          walletId: 'fake_515f73c2-027d-11ed-b939-0242ac120002',
          hardCurrency: 2000,
          softCurrency: 2000
        }
      }

      const mockFetchUserDB = sandbox.stub(modUserDB, 'getUserWalletInfoDB')
      mockFetchUserDB.onFirstCall().resolves(fakeUserGiver)
      mockFetchUserDB.onSecondCall().resolves(fakeUserRecipient)

      const invalidCurrency = 'invalid_currency'
      const amount = 100

      try {
        await transferMoneyParamsValidator(invalidCurrency as moneyTypes, fakeUserGiver.userId, fakeUserRecipient.userId, amount)
        chai.assert.fail('Expected error for invalid currency')
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errInfo = JSON.parse(err.message)
        chai.assert.equal(errInfo.message, moneyTransferParamsValidatorErrors.ErrorCurrencyType!.message)
        sandbox.assert.notCalled(mockFetchUserDB)
      }
    })
    it('Should throw an error for insufficient funds', async () => {
      const validCurrency = moneyTypesO.soft_currency
      const fakeUserGiver = {
        userId: 'fake_22ef5564-0234-11ed-b939-0242ac120002',
        firstname: 'fake_Eugene',
        lastname: 'fake_Porter',
        Wallet: {
          walletId: 'fake_515f73c2-027d-11ed-b939-0242ac120002',
          hardCurrency: 2000,
          softCurrency: 100 // Insufficient funds
        }
      }

      const fakeUserRecipient = {
        userId: 'fake_22ef5564-0234-11ed-b939-0242ac120002',
        firstname: 'fake_Eugene',
        lastname: 'fake_Porter',
        Wallet: {
          walletId: 'fake_515f73c2-027d-11ed-b939-0242ac120002',
          hardCurrency: 2000,
          softCurrency: 2000
        }
      }

      const mockFetchUserDB = sandbox.stub(modUserDB, 'getUserWalletInfoDB')
      mockFetchUserDB.onFirstCall().resolves(fakeUserGiver)
      mockFetchUserDB.onSecondCall().resolves(fakeUserRecipient)

      const amount = 200 // Attempt to transfer more than available

      try {
        await transferMoneyParamsValidator(validCurrency, fakeUserGiver.userId, fakeUserRecipient.userId, amount)
        chai.assert.fail('Expected error for insufficient funds')
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errInfo = JSON.parse(err.message)
        chai.assert.equal(errInfo.message, moneyTransferParamsValidatorErrors.ErrorInsufficientFunds!.message)
        sandbox.assert.calledOnce(mockFetchUserDB)
      }
    })
    it('Should throw an error if retrieving giver user info fails', async () => {
      const mockErrorLogger = sandbox.stub(logger, 'error')

      const validCurrency = moneyTypesO.soft_currency
      const fakeUserRecipient = {
        userId: 'fake_22ef5564-0234-11ed-b939-0242ac120002',
        firstname: 'fake_Eugene',
        lastname: 'fake_Porter',
        Wallet: {
          walletId: 'fake_515f73c2-027d-11ed-b939-0242ac120002',
          hardCurrency: 2000,
          softCurrency: 2000
        }
      }

      const mockFetchUserDB = sandbox.stub(modUserDB, 'getUserWalletInfoDB')
      mockFetchUserDB.onFirstCall().rejects(new Error('test - 1'))
      mockFetchUserDB.onSecondCall().rejects(null)

      const amount = 100

      try {
        await transferMoneyParamsValidator(validCurrency, 'fake_giver_id', fakeUserRecipient.userId, amount) // Use a fake giver ID
        chai.assert.fail('Expected error retrieving giver user info')
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errInfo = JSON.parse(err.message)
        chai.assert.equal(errInfo.message, moneyTransferParamsValidatorErrors.ErrorUserInfo!.message) // Verify specific error message
        sandbox.assert.calledOnce(mockFetchUserDB)
        sandbox.assert.called(mockErrorLogger)
      }
    })
    it('Should throw an error if retrieving receiver user info fails', async () => {
      const mockErrorLogger = sandbox.stub(logger, 'error')

      const validCurrency = moneyTypesO.soft_currency
      const fakeUserRecipient = {
        userId: 'fake_22ef5564-0234-11ed-b939-0242ac120002',
        firstname: 'fake_Eugene',
        lastname: 'fake_Porter',
        Wallet: {
          walletId: 'fake_515f73c2-027d-11ed-b939-0242ac120002',
          hardCurrency: 2000,
          softCurrency: 2000
        }
      }

      const fakeUserGiver = {
        // Define fake giver object but don't use it
        userId: 'fake_giver_id',
        firstname: 'fake_Eugene',
        lastname: 'fake_Porter',
        Wallet: {
          walletId: 'fake_515f73c2-027d-11ed-b939-0242ac120002',
          hardCurrency: 2000,
          softCurrency: 2000
        }
      }

      const mockFetchUserDB = sandbox.stub(modUserDB, 'getUserWalletInfoDB')
      mockFetchUserDB.onFirstCall().resolves(fakeUserGiver)
      mockFetchUserDB.onSecondCall().rejects(null)

      const amount = 100

      try {
        await transferMoneyParamsValidator(validCurrency, 'fake_giver_id', fakeUserRecipient.userId, amount) // Use a fake giver ID
        chai.assert.fail('Expected error retrieving giver user info')
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errInfo = JSON.parse(err.message)
        chai.assert.equal(errInfo.message, moneyTransferParamsValidatorErrors.ErrorUserInfo!.message) // Verify specific error message
        sandbox.assert.calledTwice(mockFetchUserDB)
        sandbox.assert.called(mockErrorLogger)
      }
    })
  })

  describe('src > v1 > application > services > user > index > transferMoney', () => {
    beforeEach(() => {
      sandbox.restore()
    })
    it('Successful transfer', async () => {
      // Mock all the dependent functions
      const mockTransferMoneyParamsValidator = sandbox.stub(modUser, 'transferMoneyParamsValidator').resolves([{ Wallet: { walletId: '1234', softCurrency: 123 } }, { Wallet: { walletId: '4321', softCurrency: 300 } }] as unknown as userWalletDTO[])
      const mockCreateAndStartTransaction = sandbox.stub(modConnection, 'createAndStartTransaction').resolves({ someTransactionObject: true } as unknown as transactionQueryRunnerType)
      const mockAcquireLockOnWallet = sandbox.stub(modConnection, 'acquireLockOnWallet').resolves(true)
      const mockUpdateWalletByWalletIdTransaction = sandbox.stub(modWalletDB, 'updateWalletByWalletIdTransaction').resolves(true) // Assuming update functions return success indicator (modify as needed)
      const mockRollBackAndQuitTransactionRunner = sandbox.stub(modConnection, 'rollBackAndQuitTransactionRunner')
      const mockCommitAndQuitTransactionRunner = sandbox.stub(modConnection, 'commitAndQuitTransactionRunner')
      const mockErrorLogger = sandbox.stub(logger, 'error')

      // Call the transferMoneyWithRetry function
      const result = await transferMoney(moneyTypesO.soft_currency, 'giver123', 'recipient456', 100)

      // Verify all the mocked functions were called as expected
      sandbox.assert.calledOnce(mockTransferMoneyParamsValidator)
      sandbox.assert.calledWithExactly(mockTransferMoneyParamsValidator, moneyTypesO.soft_currency, 'giver123', 'recipient456', 100)

      sandbox.assert.calledOnce(mockCreateAndStartTransaction)

      sandbox.assert.calledTwice(mockAcquireLockOnWallet)
      sandbox.assert.calledWith(mockAcquireLockOnWallet, { someTransactionObject: true } as unknown as transactionQueryRunnerType, '1234') // Replace with actual wallet ID logic
      sandbox.assert.calledWith(mockAcquireLockOnWallet, { someTransactionObject: true } as unknown as transactionQueryRunnerType, '4321') // Replace with actual wallet ID logic

      sandbox.assert.calledTwice(mockUpdateWalletByWalletIdTransaction)
      // Replace these assertions with the expected arguments and return values based on your implementation
      sandbox.assert.calledWith(mockUpdateWalletByWalletIdTransaction, { someTransactionObject: true } as unknown as transactionQueryRunnerType, '1234', moneyTypesO.soft_currency, 23)
      sandbox.assert.calledWith(mockUpdateWalletByWalletIdTransaction, { someTransactionObject: true } as unknown as transactionQueryRunnerType, '4321', moneyTypesO.soft_currency, 400)

      sandbox.assert.notCalled(mockRollBackAndQuitTransactionRunner) // No rollback expected in successful case

      sandbox.assert.calledOnce(mockCommitAndQuitTransactionRunner)

      sandbox.assert.notCalled(mockErrorLogger)

      // Expect the result to be true (successful transfer)
      chai.assert.isTrue(result)
    })
    it('Transfer failure due to transferMoneyParamsValidator error', async () => {
      const mockTransferMoneyParamsValidator = sandbox.stub(modUser, 'transferMoneyParamsValidator').rejects(new Error('Validation Error'))
      const mockCreateAndStartTransaction = sandbox.stub(modConnection, 'createAndStartTransaction').resolves({ someTransactionObject: true } as unknown as transactionQueryRunnerType)
      const mockErrorLogger = sandbox.stub(logger, 'error')

      try {
        await transferMoney(moneyTypesO.soft_currency, 'giver123', 'recipient456', 100)
        // Should not reach here if transferMoneyParamsValidator throws
        chai.assert.fail('Unexpected successful transfer')
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errInfo = JSON.parse(err.message)
        chai.assert.equal(errInfo.message, transferMoneyErrors.ErrorParamsValidator!.message)
        sandbox.assert.calledOnce(mockTransferMoneyParamsValidator)
        sandbox.assert.notCalled(mockCreateAndStartTransaction)
        sandbox.assert.called(mockErrorLogger)
      }
    })
    it('Transfer failure due to createAndStartTransaction error', async () => {
      const mockTransferMoneyParamsValidator = sandbox.stub(modUser, 'transferMoneyParamsValidator').resolves([{}, {}] as unknown as userWalletDTO[])
      const mockCreateAndStartTransaction = sandbox.stub(modConnection, 'createAndStartTransaction').rejects(new Error('Transaction Error'))
      const mockAcquireLockOnWallet = sandbox.stub(modConnection, 'acquireLockOnWallet')
      const mockErrorLogger = sandbox.stub(logger, 'error')

      try {
        await transferMoney(moneyTypesO.soft_currency, 'giver123', 'recipient456', 100)
        chai.assert.fail('Unexpected successful transfer')
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errInfo = JSON.parse(err.message)
        chai.assert.equal(errInfo.message, transferMoneyErrors.ErrorTransactionCreation!.message)
        sandbox.assert.calledOnce(mockTransferMoneyParamsValidator)
        sandbox.assert.calledOnce(mockCreateAndStartTransaction)
        sandbox.assert.called(mockErrorLogger)
        sandbox.assert.notCalled(mockAcquireLockOnWallet)
      }
    })
    it('Transfer failure due to acquireLockOnWallet failure (giver)', async () => {
      const mockTransferMoneyParamsValidator = sandbox.stub(modUser, 'transferMoneyParamsValidator').resolves([{ Wallet: { walletId: '1234', softCurrency: 123 } }, { Wallet: { walletId: '4321', softCurrency: 300 } }] as unknown as userWalletDTO[])
      const mockCreateAndStartTransaction = sandbox.stub(modConnection, 'createAndStartTransaction').resolves({ someTransactionObject: true } as unknown as transactionQueryRunnerType)
      const mockAcquireLockOnWallet = sandbox.stub(modConnection, 'acquireLockOnWallet')
      mockAcquireLockOnWallet.onFirstCall().resolves(false)
      mockAcquireLockOnWallet.onSecondCall().resolves(true)
      const mockUpdateWalletByWalletIdTransaction = sandbox.stub(modWalletDB, 'updateWalletByWalletIdTransaction').resolves(true) // Assuming update functions return success indicator (modify as needed)
      const mockErrorLogger = sandbox.stub(logger, 'error')

      try {
        await transferMoney(moneyTypesO.soft_currency, 'giver123', 'recipient456', 100)
        // Should not reach here if acquireLockOnWallet fails
        chai.assert.fail('Unexpected successful transfer')
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errInfo = JSON.parse(err.message)
        chai.assert.equal(errInfo.message, transferMoneyErrors.ErrorLockAcquisition!.message)
        sandbox.assert.calledOnce(mockTransferMoneyParamsValidator)
        sandbox.assert.calledOnce(mockCreateAndStartTransaction)
        sandbox.assert.called(mockErrorLogger)
        sandbox.assert.calledTwice(mockAcquireLockOnWallet)
        sandbox.assert.calledWith(mockAcquireLockOnWallet, { someTransactionObject: true } as unknown as transactionQueryRunnerType, '1234') // Replace with actual logic
        sandbox.assert.calledWith(mockAcquireLockOnWallet, { someTransactionObject: true } as unknown as transactionQueryRunnerType, '4321') // Replace with actual logic
        sandbox.assert.notCalled(mockUpdateWalletByWalletIdTransaction) // Not called due to earlier error
      }
    })
    it('Transfer failure due to acquireLockOnWallet failure (recipient)', async () => {
      const mockTransferMoneyParamsValidator = sandbox.stub(modUser, 'transferMoneyParamsValidator').resolves([{ Wallet: { walletId: '1234', softCurrency: 123 } }, { Wallet: { walletId: '4321', softCurrency: 300 } }] as unknown as userWalletDTO[])
      const mockCreateAndStartTransaction = sandbox.stub(modConnection, 'createAndStartTransaction').resolves({ someTransactionObject: true } as unknown as transactionQueryRunnerType)
      const mockAcquireLockOnWallet = sandbox.stub(modConnection, 'acquireLockOnWallet')
      mockAcquireLockOnWallet.onFirstCall().resolves(true)
      mockAcquireLockOnWallet.onSecondCall().resolves(false)
      const mockUpdateWalletByWalletIdTransaction = sandbox.stub(modWalletDB, 'updateWalletByWalletIdTransaction').resolves(true) // Assuming update functions return success indicator (modify as needed)
      const mockErrorLogger = sandbox.stub(logger, 'error')

      try {
        await transferMoney(moneyTypesO.soft_currency, 'giver123', 'recipient456', 100)
        // Should not reach here if update fails
        chai.assert.fail('Unexpected successful transfer')
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errorInfo = JSON.parse(err.message)
        chai.assert.equal(errorInfo.message, transferMoneyErrors.ErrorLockAcquisition!.message)
        sandbox.assert.calledOnce(mockTransferMoneyParamsValidator)
        sandbox.assert.calledOnce(mockCreateAndStartTransaction)
        sandbox.assert.called(mockErrorLogger)
        sandbox.assert.calledTwice(mockAcquireLockOnWallet)
        sandbox.assert.calledWith(mockAcquireLockOnWallet, { someTransactionObject: true } as unknown as transactionQueryRunnerType, '1234')
        sandbox.assert.calledWith(mockAcquireLockOnWallet, { someTransactionObject: true } as unknown as transactionQueryRunnerType, '4321')
        sandbox.assert.notCalled(mockUpdateWalletByWalletIdTransaction)
      }
    })
  })

  describe('src > v1 > application > services > user > index > transferMoneyWithRetry', () => {
    beforeEach(() => {
      sandbox.restore()
    })
    it('Successful transfer (no retry)', async () => {
      // Mock the transferMoney function to always succeed
      const mockTransferMoney = sandbox.stub(modUser, 'transferMoney').resolves(true)

      // Call the transferMoneyWithRetry function
      const result = await transferMoneyWithRetry(moneyTypesO.soft_currency, 'giver123', 'recipient456', 100, 300)

      // Verify the transferMoney function was called once
      sandbox.assert.calledOnce(mockTransferMoney)
      sandbox.assert.calledWithExactly(mockTransferMoney, moneyTypesO.soft_currency, 'giver123', 'recipient456', 100)

      // Expect the result to be true (successful transfer)
      chai.assert.isTrue(result)
    })
    it('Successful transfer (with 1 retry)', async () => {
      // Mock the transferMoney function to fail twice and succeed on the third try
      const mockTransferMoney = sandbox.stub(modUser, 'transferMoney')
      mockTransferMoney.onFirstCall().rejects(new Error('Error - Lock - Network error'))
      mockTransferMoney.onSecondCall().resolves(true)
      const mockWarnLogger = sandbox.stub(logger, 'warn')

      // Call the transferMoneyWithRetry function
      const result = await transferMoneyWithRetry(moneyTypesO.soft_currency, 'giver123', 'recipient456', 100, 300)

      // Verify the transferMoney function was called three times
      sandbox.assert.calledTwice(mockTransferMoney)
      sandbox.assert.calledWithExactly(mockTransferMoney, moneyTypesO.soft_currency, 'giver123', 'recipient456', 100)
      sandbox.assert.calledOnce(mockWarnLogger)

      // Expect the result to be true (successful transfer after retry)
      chai.assert.isTrue(result)
    })
    it('Failure - Transfer fail (non-retryable error)', async () => {
      // Mock the transferMoney function to throw a non-retryable error

      const fakeInsufficientFundsError: errorType = {
        name: 'fakeNetworkError',
        message: 'Not enough funds to do the transaction',
        httpCode: 500
      }

      const mockTransferMoney = sandbox.stub(modUser, 'transferMoney').throws(new Error(JSON.stringify(fakeInsufficientFundsError)))

      // Call the transferMoneyWithRetry function
      try {
        await transferMoneyWithRetry(moneyTypesO.soft_currency, 'giver123', 'recipient456', 100, 300)
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errInfo = JSON.parse(err.message)
        chai.assert(errInfo.message.includes('Not enough funds to do the transaction'))
        sandbox.assert.calledOnce(mockTransferMoney)
        chai.assert(mockTransferMoney.calledWithExactly(moneyTypesO.soft_currency, 'giver123', 'recipient456', 100))
      }
    })
    it('Failure - Transfer fail (with retryable error followed by non-retryable error)', async () => {
      const fakeNetworkError: errorType = {
        name: 'fakeNetworkError',
        message: 'Network error',
        httpCode: 500
      }
      const fakeLockError: errorType = {
        name: 'fakeLockError',
        message: 'Error - Lock - Network error',
        httpCode: 500
      }
      // Mock the transferMoney function to fail twice and succeed on the third try
      const mockTransferMoney = sandbox.stub(modUser, 'transferMoney')
      mockTransferMoney.onFirstCall().throws(new Error(JSON.stringify(fakeLockError)))
      mockTransferMoney.onSecondCall().throws(new Error(JSON.stringify(fakeNetworkError)))
      mockTransferMoney.onThirdCall().resolves(true)
      const mockWarnLogger = sandbox.stub(logger, 'warn')

      // Call the transferMoneyWithRetry function
      try {
        await transferMoneyWithRetry(moneyTypesO.soft_currency, 'giver123', 'recipient456', 100, 300)
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errorInfo = JSON.parse(err.message)
        chai.assert.isTrue(errorInfo.message.includes('Network error'))
        sandbox.assert.calledTwice(mockTransferMoney)
        sandbox.assert.calledWithExactly(mockTransferMoney, moneyTypesO.soft_currency, 'giver123', 'recipient456', 100)
        sandbox.assert.calledOnce(mockWarnLogger)
      }
    })
    it('Failure - Transfer fail (Maximum retries exceeded)', async () => {
      const mockTransferMoney = sandbox.stub(modUser, 'transferMoney')
      mockTransferMoney.onFirstCall().throws(new Error('Error - Lock - Network error'))
      mockTransferMoney.onSecondCall().throws(new Error('Error - Lock - Network error'))
      mockTransferMoney.onThirdCall().throws(new Error('Error - Lock - Network error'))
      // mockTransferMoney.onCall(4).throws(new Error("Error - Lock - Network error"))
      // mockTransferMoney.onCall(5).throws(new Error("Error - Lock - Network error"))
      // mockTransferMoney.onCall(6).throws(new Error("Error - Lock - Network error"))
      // mockTransferMoney.onCall(7).resolves(true)
      const mockWarnLogger = sandbox.stub(logger, 'warn')

      // Call the transferMoneyWithRetry function
      const maxAttempt = 3
      const amountToTransfer = 130
      const delay = 10
      try {
        await transferMoneyWithRetry(moneyTypesO.soft_currency, 'giver123', 'recipient456', amountToTransfer, delay, maxAttempt)
      } catch (err) {
        if (!(err instanceof Error) || err?.message === null) {
          chai.assert.fail('Please use a correct error format')
        }
        const errorInfo = JSON.parse(err.message)
        chai.assert.isTrue(errorInfo.message === transferMoneyWithRetryErrors.ErrorMaxRetry!.message)
        sandbox.assert.callCount(mockTransferMoney, maxAttempt)
        sandbox.assert.calledWithExactly(mockTransferMoney, moneyTypesO.soft_currency, 'giver123', 'recipient456', amountToTransfer)
        sandbox.assert.callCount(mockWarnLogger, maxAttempt)
      }
    })
  })
})
