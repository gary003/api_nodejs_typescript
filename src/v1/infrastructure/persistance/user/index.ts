import { Wallet } from '../wallet/entity'
import { getConnection } from '../connection/connectionFile'
import { User } from './entity'
import { createNewWalletDB, deleteWalletByIdDB } from '../wallet'
import { Readable } from 'stream'
import { ReadStream } from 'typeorm/platform/PlatformTools'
import logger from '../../../helpers/logger'
import { userWalletDTO } from '../../../application/services/user/dto'

export const getAllUsersDB = async (): Promise<userWalletDTO[]> => {
  const connection = await getConnection()

  const UserRepository = connection.getRepository(User)

  const result = await UserRepository.createQueryBuilder('user')
    .innerJoinAndMapOne('user.Wallet', Wallet, 'wallet', 'wallet.userId = user.userId')
    .getMany()
    .catch((err) => err)

  if (result instanceof Error) {
    logger.error(result)
    throw new Error(`Impossible to retreive any user - ${result.message}`)
  }

  // logger.debug(JSON.stringify(result))

  return result as userWalletDTO[]
}

export const userStreamAdaptor = async function* (source: ReadStream): AsyncGenerator<string> {
  try {
    for await (const chunk of source) {
      const adaptedData: userWalletDTO = {
        userId: chunk.user_userId,
        firstname: chunk.user_firstname,
        lastname: chunk.user_lastname,
        Wallet: {
          walletId: chunk.wallet_walletId,
          hardCurrency: chunk.wallet_hardCurrency,
          softCurrency: chunk.wallet_softCurrency
        }
      }

      yield JSON.stringify(adaptedData) + '\n'
    }
  } catch (err) {
    logger.error(err)
    throw new Error(`Strem Adaptor error - ${String(err)}`)
  }
}

export const getAllUsersStreamDB = async (): Promise<Readable> => {
  const connection = await getConnection()

  const UserRepository = connection.getRepository(User)

  const userStream = await UserRepository.createQueryBuilder('user').innerJoinAndMapOne('user.Wallet', Wallet, 'wallet', 'wallet.userId = user.userId').stream()

  // Convert the generator to a readable stream
  const readableStream = Readable.from(userStreamAdaptor(userStream), {
    objectMode: true
  })

  return readableStream
}

export const saveNewUserDB = async (userId: string, firstname: string, lastname: string): Promise<User> => {
  const newUser = new User()
  newUser.userId = userId
  newUser.firstname = firstname
  newUser.lastname = lastname

  const walletCreation = await createNewWalletDB(newUser).catch((err) => err)

  if (walletCreation instanceof Error) {
    logger.error(walletCreation)
    throw new Error(`Impossible to create a new wallet or user - ${String(walletCreation)}`)
  }

  return newUser
}

export const deleteUserByIdDB = async (userId: string): Promise<boolean> => {
  const connection = await getConnection()

  const userToDeleteInfo = await getUserWalletInfoDB(userId).catch((err) => err)

  if (userToDeleteInfo instanceof Error) {
    logger.error(userToDeleteInfo)
    throw new Error(`Impossible to delete the user in DB, no user information available (step : 0) - ${String(userToDeleteInfo)}`)
  }
  // logger.debug(JSON.stringify(userToDeleteInfo))

  if (userToDeleteInfo.Wallet) {
    const walletDeletion = await deleteWalletByIdDB(String(userToDeleteInfo.Wallet.walletId)).catch((err) => err)

    if (walletDeletion instanceof Error) {
      logger.error(walletDeletion)
      throw new Error(`Impossible to delete the user in DB (step : 1) - ${String(walletDeletion)}`)
    }
  }

  // Let the db some time to handle the previous request
  await new Promise((resolve) => setTimeout(resolve, 709))

  const UserRepository = connection.getRepository(User)

  const deletedUser = await UserRepository.delete(userId).catch((err) => err)

  if (deletedUser instanceof Error || deletedUser.affected === 0) {
    logger.error(deletedUser)
    throw new Error(`Impossible to delete the user in DB (step : 2) - ${deletedUser.message}`)
  }

  return true
}

export const getUserWalletInfoDB = async (userId: string): Promise<userWalletDTO> => {
  const connection = await getConnection()

  const UserRepository = connection.getRepository(User)

  const userWalletInfo = await UserRepository.createQueryBuilder('user')
    .innerJoinAndMapOne('user.Wallet', Wallet, 'wallets', 'wallets.userId = user.userId')
    .where('user.userId = :userId', { userId: userId })
    .getOne()
    .catch((err) => err)

  if (userWalletInfo instanceof Error) {
    logger.error(userWalletInfo)
    throw new Error(`Impossible to get the user informations - ${userWalletInfo.message} `)
  }

  if (userWalletInfo == null) {
    throw new Error(`Impossible to get any user with that id (response is null - user dont exists)`)
  }

  return userWalletInfo as userWalletDTO
}

// // Create a transform stream from your generator
// const createAdaptorStream = () => {
//   return new Transform({
//     objectMode: true,
//     transform(chunk, _, callback) {
//       try {
//         const structuredData = {
//           userId: chunk.user_userId,
//           firstname: chunk.user_firstname,
//           lastname: chunk.user_lastname,
//           wallet: {
//             walletId: chunk.wallet_walletId,
//             hardCurrency: chunk.wallet_hardCurrency,
//             softCurrency: chunk.wallet_softCurrency,
//             userId: chunk.wallet_userId
//           }
//         }
//         callback(null, JSON.stringify(structuredData) + '\n')
//       } catch (err) {
//         callback(err instanceof Error ? err : new Error('Transform error'))
//       }
//     }
//   })
// }

// export const getAllUsersStreamDB = async (): Promise<any> => {
//   const connection = await connectionDB()

//   const UserRepository = connection.getRepository(User)

//   const userStream = await UserRepository.createQueryBuilder('user').innerJoinAndMapOne('user.Wallet', Wallet, 'wallet', 'wallet.userId = user.userId').stream()

//   // userStream.on('data', (d) => console.log(d))

//   // !! Nevere do this ! because the stream will be destroy before the end of the process and make everything fail !!
//   // userStream.on('end', () => userStream.close())

//   return userStream.pipe(createAdaptorStream())
// }
