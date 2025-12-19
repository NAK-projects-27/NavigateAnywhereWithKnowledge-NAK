
  create table "public"."destinations" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "trip_id" uuid not null,
    "name" text not null,
    "description" text,
    "latitude" double precision not null,
    "longitude" double precision not null,
    "visit_date" date,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."destinations" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "email" text,
    "full_name" text,
    "bio" text,
    "avatar_url" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."profiles" enable row level security;


  create table "public"."trips" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "title" text not null,
    "description" text,
    "start_date" date,
    "end_date" date,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."trips" enable row level security;

CREATE UNIQUE INDEX destinations_pkey ON public.destinations USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX trips_pkey ON public.trips USING btree (id);

alter table "public"."destinations" add constraint "destinations_pkey" PRIMARY KEY using index "destinations_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."trips" add constraint "trips_pkey" PRIMARY KEY using index "trips_pkey";

alter table "public"."destinations" add constraint "destinations_trip_id_fkey" FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE not valid;

alter table "public"."destinations" validate constraint "destinations_trip_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."trips" add constraint "trips_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."trips" validate constraint "trips_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

grant delete on table "public"."destinations" to "anon";

grant insert on table "public"."destinations" to "anon";

grant references on table "public"."destinations" to "anon";

grant select on table "public"."destinations" to "anon";

grant trigger on table "public"."destinations" to "anon";

grant truncate on table "public"."destinations" to "anon";

grant update on table "public"."destinations" to "anon";

grant delete on table "public"."destinations" to "authenticated";

grant insert on table "public"."destinations" to "authenticated";

grant references on table "public"."destinations" to "authenticated";

grant select on table "public"."destinations" to "authenticated";

grant trigger on table "public"."destinations" to "authenticated";

grant truncate on table "public"."destinations" to "authenticated";

grant update on table "public"."destinations" to "authenticated";

grant delete on table "public"."destinations" to "service_role";

grant insert on table "public"."destinations" to "service_role";

grant references on table "public"."destinations" to "service_role";

grant select on table "public"."destinations" to "service_role";

grant trigger on table "public"."destinations" to "service_role";

grant truncate on table "public"."destinations" to "service_role";

grant update on table "public"."destinations" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."trips" to "anon";

grant insert on table "public"."trips" to "anon";

grant references on table "public"."trips" to "anon";

grant select on table "public"."trips" to "anon";

grant trigger on table "public"."trips" to "anon";

grant truncate on table "public"."trips" to "anon";

grant update on table "public"."trips" to "anon";

grant delete on table "public"."trips" to "authenticated";

grant insert on table "public"."trips" to "authenticated";

grant references on table "public"."trips" to "authenticated";

grant select on table "public"."trips" to "authenticated";

grant trigger on table "public"."trips" to "authenticated";

grant truncate on table "public"."trips" to "authenticated";

grant update on table "public"."trips" to "authenticated";

grant delete on table "public"."trips" to "service_role";

grant insert on table "public"."trips" to "service_role";

grant references on table "public"."trips" to "service_role";

grant select on table "public"."trips" to "service_role";

grant trigger on table "public"."trips" to "service_role";

grant truncate on table "public"."trips" to "service_role";

grant update on table "public"."trips" to "service_role";


  create policy "Users can delete destinations of their trips"
  on "public"."destinations"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = destinations.trip_id) AND (trips.user_id = auth.uid())))));



  create policy "Users can insert destinations to their trips"
  on "public"."destinations"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = destinations.trip_id) AND (trips.user_id = auth.uid())))));



  create policy "Users can update destinations of their trips"
  on "public"."destinations"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = destinations.trip_id) AND (trips.user_id = auth.uid())))));



  create policy "Users can view destinations of their trips"
  on "public"."destinations"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = destinations.trip_id) AND (trips.user_id = auth.uid())))));



  create policy "Public profiles are viewable by everyone"
  on "public"."profiles"
  as permissive
  for select
  to public
using (true);



  create policy "Users can insert own profile"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "Users can update own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Users can delete their own trips"
  on "public"."trips"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert their own trips"
  on "public"."trips"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update their own trips"
  on "public"."trips"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view their own trips"
  on "public"."trips"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));


CREATE TRIGGER handle_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


