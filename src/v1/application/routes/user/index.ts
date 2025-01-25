import { Router, Request, Response } from 'express'
import { deleteUserById, getAllUsers, getAllUsersStream, getUserWalletInfo, saveNewUser } from '../../services/user/index'

import { errorAPIUSER } from './error.dto'

import logger from '../../../helpers/logger'
import { validateUserIdParams } from './validation'
import { apiResponseGetAllUserType, apiResponseGetUserType, apiResponseCreateUserType, apiResponseDeleteUserType } from './apiResponse.dto'
import { userWalletDTO } from '../../services/user/dto'

const userRouter = Router()

userRouter
  .route('/')
  .get(async (_: Request, res: Response) => {
    const results = await getAllUsers().catch((err) => err)

    if (results instanceof Error) {
      return res.status(500).json(errorAPIUSER.errorAPIGetAllUsers)
    }

    const apiRes: apiResponseGetAllUserType = { data: results as userWalletDTO[] }

    return res.status(200).json(apiRes)
  })
  .post(async (req: Request, res: Response) => {
    const { userId, firstname, lastname } = req.body

    const result = await saveNewUser(userId, firstname, lastname).catch((err) => {
      logger.error(err)
      return null
    })

    if (result === null) return res.status(500).json(errorAPIUSER.errorAPIUserCreation)

    const response: apiResponseCreateUserType = { data: result }

    return res.status(200).json(response)
  })

userRouter.route('/stream').get(async (_: Request, res: Response) => {
  const usersStream = await getAllUsersStream().catch((err) => err)

  if (usersStream instanceof Error) return res.status(500).json(errorAPIUSER.errorAPIGetAllUsers)

  // usersStream.on('data', (d: any) => console.log(d))
  return usersStream.pipe(res)
})

userRouter
  .route('/:userId')
  .get(validateUserIdParams, async (req: Request, res: Response) => {
    const result = await getUserWalletInfo(String(req.params.userId)).catch((err) => err)

    if (result instanceof Error) {
      const errorMessage = JSON.parse(result.message)
      return res.status(500).json(errorMessage)
    }

    return res.status(200).json({ data: result } as apiResponseGetUserType)
  })
  .delete(validateUserIdParams, async (req: Request, res: Response) => {
    const result = await deleteUserById(String(req.params.userId)).catch((err) => err)

    if (result instanceof Error) return res.status(500).json(errorAPIUSER.errorAPIDeleteUser)

    return res.status(200).json({ data: result } as apiResponseDeleteUserType)
  })

export default userRouter
