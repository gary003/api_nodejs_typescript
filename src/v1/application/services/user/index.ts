import { acquireLockOnWallet, commitAndQuitTransactionRunner, createAndStartTransaction, rollBackAndQuitTransactionRunner } from '../../../infrastructure/persistance/connection/connectionFile'
import { getAllUsersDB, getUserWalletInfoDB, saveNewUserDB, deleteUserByIdDB, getAllUsersStreamDB } from '../../../infrastructure/persistance/user'
import { updateWalletByWalletIdDB, updateWalletByWalletIdTransaction } from '../../../infrastructure/persistance/wallet'
import { moneyTypes, moneyTypesO } from '../../../domain'
import { userWalletDTO } from './dto'
import { transferMoneyErrors, userFunctionsErrors, moneyTransferParamsValidatorErrors, transferMoneyWithRetryErrors } from './error.dto'
import logger from '../../../helpers/logger'
import { errorType } from '../../../domain/error'

export const getAllUsers = async (): Promise<userWalletDTO[]> => {
  const allUsers = await getAllUsersDB().catch((err) => err)

  if (allUsers instanceof Error) {
    const allUsersError = JSON.stringify({ ...userFunctionsErrors.ErrorRetrievingUser, rawError: String(allUsers) })
    logger.error(allUsersError)
    throw new Error(allUsersError)
  }

  return allUsers as unknown as userWalletDTO[]
}

export const getAllUsersStream = async () => {
  const streamUsers = await getAllUsersStreamDB().catch((err) => err)

  if (streamUsers instanceof Error) {
    const errorStream = JSON.stringify({ ...userFunctionsErrors.ErrorRetrievingUsers, rawError: String(streamUsers) })
    logger.error(errorStream)
    throw new Error(errorStream)
  }

  return streamUsers
}

export const saveNewUser = async (userId: string, firstname: string, lastname: string): Promise<userWalletDTO> => {
  const newUser = await saveNewUserDB(userId, firstname, lastname).catch((err) => err)

  if (newUser instanceof Error) {
    const saveError = JSON.stringify({ ...userFunctionsErrors.ErrorCreatingUser, rawError: String(newUser) })
    logger.error(saveError)
    throw new Error(saveError)
  }

  return newUser as unknown as userWalletDTO
}

export const addCurrency = async (userId: string, currencyType: moneyTypes, amount: number): Promise<boolean> => {
  if (amount <= 0) throw new Error(JSON.stringify(moneyTransferParamsValidatorErrors.ErrorInvalidAmount))
  if (!Object.values(moneyTypesO).includes(currencyType)) throw new Error(JSON.stringify(moneyTransferParamsValidatorErrors.ErrorCurrencyType))

  const currentUserWalletInfo = await getUserWalletInfo(userId).catch((err) => err)

  if (currentUserWalletInfo instanceof Error) {
    const userInfoError = JSON.stringify({ ...userFunctionsErrors.ErrorGettingWalletInfo, rawError: String(currentUserWalletInfo) })
    logger.error(userInfoError)
    throw new Error(userInfoError)
  }

  if (!currentUserWalletInfo.Wallet) {
    logger.error(userFunctionsErrors.ErrorNoWalletUser)
    throw new Error(JSON.stringify(userFunctionsErrors.ErrorNoWalletUser))
  }

  const resultUpdate = await updateWalletByWalletIdDB(String(currentUserWalletInfo.Wallet.walletId), currencyType, Number(currentUserWalletInfo.Wallet[currencyType]) + amount).catch((err) => err)

  if (resultUpdate instanceof Error) {
    logger.error(userFunctionsErrors.ErrorUpdating)
    logger.error(resultUpdate)
    throw new Error(JSON.stringify(userFunctionsErrors.ErrorUpdating))
  }

  return true
}

export const deleteUserById = async (userId: string): Promise<boolean> => {
  const deletedUser = await deleteUserByIdDB(userId).catch((err) => err)

  if (deletedUser instanceof Error) {
    const deleteError = JSON.stringify({ ...userFunctionsErrors.ErrorDeletingUser, rawError: String(deletedUser) })
    logger.error(deleteError)
    throw new Error(deleteError)
  }

  return deletedUser
}

export const getUserWalletInfo = async (userId: string): Promise<userWalletDTO> => {
  const userWalletI = await getUserWalletInfoDB(userId).catch((err) => err)

  if (userWalletI instanceof Error) {
    const fetchError = JSON.stringify({ ...userFunctionsErrors.ErrorFetchingUserInfo, rawError: String(userWalletI) })
    logger.error(fetchError)
    throw new Error(fetchError)
  }

  return userWalletI
}

export const transferMoneyParamsValidator = async (currency: moneyTypes, giverId: string, recipientId: string, amount: number): Promise<userWalletDTO[]> => {
  if (!Object.values(moneyTypesO).includes(currency)) throw new Error(JSON.stringify(moneyTransferParamsValidatorErrors.ErrorCurrencyType))

  const giverUserInfo = await getUserWalletInfoDB(giverId).catch((error) => error)

  if (giverUserInfo instanceof Error) {
    const giverUserInfoError = JSON.stringify({ ...moneyTransferParamsValidatorErrors.ErrorUserInfo, giverUserInfo: String(giverUserInfo) })
    logger.error(giverUserInfoError)
    throw new Error(giverUserInfoError)
  }

  if (!giverUserInfo.Wallet) {
    const error = JSON.stringify({ ...userFunctionsErrors.ErrorNoWalletUser, rawError: String(giverUserInfo) })
    logger.error(error)
    throw new Error(error)
  }

  const giverNewBalance = Number(giverUserInfo.Wallet[currency]) - amount

  if (giverNewBalance < 0) throw new Error(JSON.stringify(moneyTransferParamsValidatorErrors.ErrorInsufficientFunds))

  const recipientUserInfo = await getUserWalletInfoDB(recipientId).catch((error) => error)

  if (recipientUserInfo instanceof Error) {
    const recipientUserInfoError = JSON.stringify({ ...moneyTransferParamsValidatorErrors.ErrorUserInfo, rawError: String(recipientUserInfo) })
    logger.error(recipientUserInfo)
    throw new Error(recipientUserInfoError)
  }

  if (!recipientUserInfo.Wallet) {
    const error = JSON.stringify({ ...userFunctionsErrors.ErrorNoWalletUser, rawError: String(recipientUserInfo) })
    logger.error(error)
    throw new Error(error)
  }

  // logger.debug(JSON.stringify({ giverUserInfo, giverNewBalance }))

  return [giverUserInfo, recipientUserInfo]
}

export const transferMoney = async (currency: moneyTypes, giverId: string, recipientId: string, amount: number): Promise<boolean> => {
  const res = await transferMoneyParamsValidator(currency, giverId, recipientId, amount).catch((err) => err)

  if (res instanceof Error) {
    const paramError = JSON.stringify({ ...transferMoneyErrors.ErrorParamsValidator, rawError: String(res) })
    logger.error(paramError)
    throw new Error(paramError) // Use pre-defined error
  }

  const [giverUserInfo, recipientUserInfo]: userWalletDTO[] = res

  if (!giverUserInfo || !recipientUserInfo) {
    logger.error(transferMoneyErrors.ErrorParamsValidator)
    throw new Error(JSON.stringify(transferMoneyErrors.ErrorParamsValidator)) // Use pre-defined error
  }

  const transacRunner = await createAndStartTransaction().catch((err) => err)

  if (transacRunner instanceof Error) {
    const transacRunnerError = JSON.stringify({ ...transferMoneyErrors.ErrorTransactionCreation, rawError: String(transacRunner) })
    logger.error(transacRunnerError)
    throw new Error(transacRunnerError) // Use pre-defined error
  }

  // Acquire locks on giver and recipient wallets (pessimistic locking)
  const lockResultGiver: boolean = await acquireLockOnWallet(transacRunner, String(giverUserInfo.Wallet.walletId))
  const lockResultRecipient: boolean = await acquireLockOnWallet(transacRunner, String(recipientUserInfo.Wallet.walletId))

  if (!lockResultGiver || !lockResultRecipient) {
    const errorLock = JSON.stringify(transferMoneyErrors.ErrorLockAcquisition)
    logger.error(errorLock)
    throw new Error(errorLock)
  }

  const giverNewBalance: number = Number(giverUserInfo.Wallet[currency]) - amount

  const updateWalletGiverResult = await updateWalletByWalletIdTransaction(transacRunner, String(giverUserInfo.Wallet.walletId), currency, giverNewBalance).catch((err) => err)

  if (updateWalletGiverResult instanceof Error) {
    const updateError = JSON.stringify({ ...transferMoneyErrors.ErrorUpdateGiverWallet, rawError: String(updateWalletGiverResult) })
    logger.error(updateError)
    rollBackAndQuitTransactionRunner(transacRunner)
    throw new Error(updateError)
  }

  const recipientNewBalance: number = Number(recipientUserInfo.Wallet[currency]) + amount

  const updateWalletRecipientResult = await updateWalletByWalletIdTransaction(transacRunner, String(recipientUserInfo.Wallet.walletId), currency, recipientNewBalance).catch((err) => err)

  if (updateWalletRecipientResult instanceof Error) {
    const updateWalletRecipientError = JSON.stringify({ ...transferMoneyErrors.ErrorUpdateRecipientWallet, rawError: String(updateWalletRecipientResult) })
    logger.error(updateWalletRecipientError)
    rollBackAndQuitTransactionRunner(transacRunner)
    throw new Error(updateWalletRecipientError)
  }

  commitAndQuitTransactionRunner(transacRunner)

  return true
}

export const transferMoneyWithRetry = async (currency: moneyTypes, giverId: string, recipientId: string, amount: number, delayTime = 300, maxRetries = 3, attempt = 1): Promise<boolean> => {
  try {
    return await transferMoney(currency, giverId, recipientId, amount)
  } catch (err) {
    const errInfo = err as errorType
    if (attempt >= maxRetries) {
      logger.warn(`Transfer failed - Max retry attempt reached: ${attempt} attempts`)
      throw new Error(JSON.stringify({ ...transferMoneyWithRetryErrors.ErrorMaxRetry, maxRetries }))
    } else if (!!errInfo && errInfo.message.includes('Error - Lock')) {
      const delay = delayTime * 2 ** (attempt - 1)
      logger.warn(`Transfer failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return transferMoneyWithRetry(currency, giverId, recipientId, amount, delay, maxRetries, attempt + 1)
    } else {
      throw new Error(errInfo.message) // Re-throw non-retryable errors
    }
  }
}
