import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from '../memberships/entities/membership.entity';
import { MembersService } from './members.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Membership])],
  controllers: [UsersController],
  providers: [MembersService],
})
export class UsersModule {}
