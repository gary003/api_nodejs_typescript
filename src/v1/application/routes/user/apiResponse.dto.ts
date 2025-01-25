import { userWalletDTO } from '../../services/user/dto'

export type apiResponseGetAllUserType = {
  data: userWalletDTO[]
}

export type apiResponseGetUserType = {
  data: userWalletDTO
}

export type apiResponseDeleteUserType = {
  data: boolean
}

export type apiResponseCreateUserType = apiResponseGetUserType
