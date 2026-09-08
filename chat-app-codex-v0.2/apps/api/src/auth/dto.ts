import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,24}$/, { message: 'Username deve ter 3-24 caracteres: letras, números ou _' })
  username!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  displayName!: string;
}

export class LoginDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,24}$/)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
