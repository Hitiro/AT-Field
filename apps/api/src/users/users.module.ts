import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from '../memberships/entities/membership.entity.js';
import { MembersService } from './members.service.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Membership])],
  controllers: [UsersController],
  providers: [MembersService],
})
export class UsersModule {}
